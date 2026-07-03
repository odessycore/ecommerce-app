import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { paginate, Paginated } from '../common/dto/pagination.dto';
import { generateOrderNumber } from '../common/utils/order-number';
import {
  CreateReturnDto,
  OrderQueryDto,
  RefundOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

interface CreateDraftParams {
  cartId: string;
  userId?: string;
  email: string;
  shippingAddress?: Prisma.InputJsonValue;
  billingAddress?: Prisma.InputJsonValue;
  customerNote?: string;
}

const ORDER_DETAIL_INCLUDE = {
  items: true,
  payments: true,
  refunds: true,
  returns: { include: { items: true } },
  events: { orderBy: { createdAt: 'desc' } },
  customer: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly analytics: AnalyticsService,
  ) {}

  async createDraftFromCart(params: CreateDraftParams) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUniqueOrThrow({
        where: { id: params.cartId },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });
      if (cart.items.length === 0) {
        throw new BadRequestException('Cannot checkout an empty cart');
      }

      const lineItems = cart.items.map((item) => ({
        variantId: item.variantId,
        productName: item.variant.product.name,
        variantName: item.variant.name,
        sku: item.variant.sku,
        unitAmount: item.variant.priceAmount,
        quantity: item.quantity,
        totalAmount: item.variant.priceAmount * item.quantity,
      }));
      const subtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);

      for (const item of cart.items) {
        await this.reserveStock(tx, item.variantId, item.quantity, item.variant.name);
      }

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: params.userId,
          email: params.email,
          cartId: cart.id,
          currency: cart.currency,
          subtotalAmount: subtotal,
          totalAmount: subtotal,
          shippingAddress: params.shippingAddress,
          billingAddress: params.billingAddress,
          customerNote: params.customerNote,
          items: { create: lineItems },
          events: {
            create: { type: 'ORDER_CREATED', message: 'Order created from cart' },
          },
        },
        include: { items: true },
      });
      return order;
    });
  }

  // Atomically holds stock for an unpaid order. The conditional update fails (0 rows) when
  // available stock (inventory − reserved) is insufficient, preventing oversell.
  private async reserveStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    variantName: string,
  ): Promise<void> {
    const reserved = await tx.$executeRaw(Prisma.sql`
      UPDATE "product_variants"
      SET "reservedQuantity" = "reservedQuantity" + ${quantity}
      WHERE "id" = ${variantId}::uuid
        AND "inventoryQuantity" - "reservedQuantity" >= ${quantity}`);
    if (reserved === 0) {
      throw new BadRequestException(`${variantName} is out of stock`);
    }
  }

  // Idempotent: safe to call for every (possibly duplicated) `payment_intent.succeeded`
  // delivery. The conditional updateMany is the concurrency guard — only the first call
  // that transitions the order out of an unpaid state performs the side effects.
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: paymentIntentId },
      include: { order: true },
    });
    if (!payment) return;

    const placed = await this.prisma.$transaction(async (tx) => {
      const transition = await tx.order.updateMany({
        where: {
          id: payment.orderId,
          paymentStatus: { not: PaymentStatus.SUCCEEDED },
          status: { not: OrderStatus.CANCELLED },
        },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.SUCCEEDED,
          placedAt: new Date(),
        },
      });
      if (transition.count === 0) return false;

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      await tx.orderEvent.create({
        data: {
          orderId: payment.orderId,
          type: 'PAYMENT_SUCCEEDED',
          message: 'Payment captured',
        },
      });

      const items = await tx.orderItem.findMany({ where: { orderId: payment.orderId } });
      for (const item of items) {
        if (item.variantId) {
          // Convert the hold into a sale: draw down real stock and release the reservation.
          await tx.$executeRaw(Prisma.sql`
            UPDATE "product_variants"
            SET "inventoryQuantity" = "inventoryQuantity" - ${item.quantity},
                "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity})
            WHERE "id" = ${item.variantId}::uuid`);
        }
      }
      if (payment.order.cartId) {
        await tx.cart.update({
          where: { id: payment.order.cartId },
          data: { status: 'CONVERTED' },
        });
      }
      return true;
    });

    if (placed) {
      await this.analytics.track({
        type: 'ORDER_PLACED',
        userId: payment.order.customerId ?? undefined,
        data: { orderId: payment.orderId, amount: payment.amount },
      });
    }
  }

  async markPaymentFailed(paymentIntentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: paymentIntentId },
    });
    if (!payment) return;

    await this.prisma.$transaction([
      this.prisma.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.SUCCEEDED } },
        data: { status: PaymentStatus.FAILED },
      }),
      this.prisma.order.updateMany({
        where: { id: payment.orderId, paymentStatus: { not: PaymentStatus.SUCCEEDED } },
        data: { paymentStatus: PaymentStatus.FAILED },
      }),
      this.prisma.orderEvent.create({
        data: {
          orderId: payment.orderId,
          type: 'PAYMENT_FAILED',
          message: 'Payment attempt failed',
        },
      }),
    ]);
  }

  // Cancels unpaid orders whose reservation has expired: returns held stock, voids the
  // PaymentIntent so it can't capture later, and detaches the cart so it can be re-checked-out.
  async expireStalePendingOrders(ttlMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.REQUIRES_PAYMENT,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        items: { select: { variantId: true, quantity: true } },
        payments: { select: { providerRef: true } },
      },
    });

    for (const order of stale) {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cartId: null,
          },
        });
        if (result.count === 0) return false;
        await this.releaseReservations(tx, order.items);
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'ORDER_EXPIRED',
            message: 'Cancelled — payment not completed in time',
          },
        });
        return true;
      });

      if (cancelled) {
        for (const payment of order.payments) {
          if (payment.providerRef) await this.stripe.cancelPaymentIntent(payment.providerRef);
        }
      }
    }
    return stale.length;
  }

  private async releaseReservations(
    tx: Prisma.TransactionClient,
    items: { variantId: string | null; quantity: number }[],
  ): Promise<void> {
    for (const item of items) {
      if (!item.variantId) continue;
      await tx.$executeRaw(Prisma.sql`
        UPDATE "product_variants"
        SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity})
        WHERE "id" = ${item.variantId}::uuid`);
    }
  }

  async findManyForAdmin(query: OrderQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      customerId: query.customerId,
      orderNumber: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };
    const { page, pageSize } = query;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOneForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findManyForCustomer(userId: string, query: OrderQueryDto) {
    return this.findManyForAdmin({ ...query, customerId: userId });
  }

  async findOneForCustomer(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: userId },
      include: { items: true, refunds: true, returns: true, events: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, actorId?: string) {
    const order = await this.findOneForAdmin(id);
    const fulfillmentStatus =
      dto.status === OrderStatus.FULFILLED || dto.status === OrderStatus.COMPLETED
        ? 'FULFILLED'
        : undefined;

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: dto.status,
        fulfillmentStatus,
        cancelledAt: dto.status === OrderStatus.CANCELLED ? new Date() : undefined,
        events: {
          create: {
            type: 'STATUS_CHANGED',
            message: dto.note ?? `Status changed to ${dto.status}`,
            data: { status: dto.status },
          },
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    await this.audit(actorId, 'order.status_changed', order.id, { status: dto.status });
    return updated;
  }

  // Two-phase to keep refunds correct under concurrency without holding a DB lock across
  // the Stripe call:
  //   1. Reserve — lock the order row (FOR UPDATE), validate against the live refundable
  //      balance, and commit the reservation (Refund row PENDING + bumped refundedAmount).
  //      Concurrent refunds block on the lock and then see the updated balance.
  //   2. Execute — call Stripe outside the lock; on success finalize, on failure release
  //      the reservation so the funds become refundable again.
  async refund(id: string, dto: RefundOrderDto, actorId?: string) {
    const reservation = await this.reserveRefund(id, dto);

    try {
      const stripeRefund = await this.stripe.refund(
        reservation.paymentProviderRef,
        reservation.amount,
        reservation.idempotencyKey,
        { refundId: reservation.refundId },
      );
      await this.finalizeRefund(
        reservation.refundId,
        id,
        stripeRefund.id,
        reservation.amount,
        reservation.currency,
        dto.reason ?? null,
      );
      await this.audit(actorId, 'order.refunded', id, { amount: reservation.amount });
    } catch {
      await this.releaseRefund(id, reservation.refundId, reservation.amount);
      throw new BadRequestException('Refund failed at the payment provider');
    }

    return this.findOneForAdmin(id);
  }

  // Periodically resolves refunds left PENDING by a crash between reservation and the
  // provider call. The Stripe state is identified by metadata (not blind replay), so a
  // refund that already happened is recorded rather than issued twice.
  async reconcilePendingRefunds(olderThanMs = 2 * 60_000): Promise<void> {
    if (!this.stripe.isConfigured) return;

    const cutoff = new Date(Date.now() - olderThanMs);
    const pending = await this.prisma.refund.findMany({
      where: { status: RefundStatus.PENDING, createdAt: { lt: cutoff } },
      include: { payment: true, order: { select: { currency: true } } },
    });

    for (const refund of pending) {
      const paymentIntentId = refund.payment?.providerRef;
      if (!paymentIntentId || !refund.idempotencyKey) continue;

      try {
        const existing = await this.stripe.findRefundByMetadata(paymentIntentId, refund.id);
        if (existing && existing.status === 'succeeded') {
          await this.finalizeRefund(
            refund.id,
            refund.orderId,
            existing.id,
            refund.amount,
            refund.order.currency,
            refund.reason ?? null,
          );
        } else if (existing && (existing.status === 'failed' || existing.status === 'canceled')) {
          await this.releaseRefund(refund.orderId, refund.id, refund.amount);
        } else if (!existing) {
          const created = await this.stripe.refund(
            paymentIntentId,
            refund.amount,
            refund.idempotencyKey,
            { refundId: refund.id },
          );
          await this.finalizeRefund(
            refund.id,
            refund.orderId,
            created.id,
            refund.amount,
            refund.order.currency,
            refund.reason ?? null,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Refund ${refund.id} reconciliation deferred: ${(error as Error).message}`,
        );
      }
    }
  }

  private async finalizeRefund(
    refundId: string,
    orderId: string,
    providerRef: string,
    amount: number,
    currency: string,
    reason: string | null,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.SUCCEEDED, providerRef },
      }),
      this.prisma.orderEvent.create({
        data: {
          orderId,
          type: 'REFUND_ISSUED',
          message: `Refunded ${amount} ${currency}`,
          data: { amount, reason },
        },
      }),
    ]);
  }

  private async reserveRefund(id: string, dto: RefundOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        { refundedAmount: number; totalAmount: number; currency: string }[]
      >(Prisma.sql`
        SELECT "refundedAmount", "totalAmount", "currency"
        FROM "orders" WHERE "id" = ${id}::uuid FOR UPDATE`);
      if (!locked) throw new NotFoundException('Order not found');

      const payment = await tx.payment.findFirst({
        where: { orderId: id, status: PaymentStatus.SUCCEEDED },
      });
      if (!payment || !payment.providerRef) {
        throw new BadRequestException('No captured payment to refund');
      }

      const refundedBefore = Number(locked.refundedAmount);
      const total = Number(locked.totalAmount);
      const amount = dto.amount ?? total - refundedBefore;
      if (amount <= 0 || amount > total - refundedBefore) {
        throw new BadRequestException('Invalid refund amount');
      }

      const refundedTotal = refundedBefore + amount;
      const refund = await tx.refund.create({
        data: {
          orderId: id,
          paymentId: payment.id,
          amount,
          reason: dto.reason,
          status: RefundStatus.PENDING,
          idempotencyKey: `refund:${id}:${refundedBefore}:${amount}`,
        },
      });
      await tx.order.update({
        where: { id },
        data: {
          refundedAmount: refundedTotal,
          paymentStatus: this.refundPaymentStatus(refundedTotal, total),
        },
      });

      return {
        refundId: refund.id,
        paymentProviderRef: payment.providerRef,
        idempotencyKey: refund.idempotencyKey as string,
        amount,
        currency: locked.currency,
      };
    });
  }

  private async releaseRefund(id: string, refundId: string, amount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        { refundedAmount: number; totalAmount: number }[]
      >(Prisma.sql`
        SELECT "refundedAmount", "totalAmount"
        FROM "orders" WHERE "id" = ${id}::uuid FOR UPDATE`);
      const released = Math.max(0, Number(locked.refundedAmount) - amount);
      await tx.order.update({
        where: { id },
        data: {
          refundedAmount: released,
          paymentStatus: this.refundPaymentStatus(released, Number(locked.totalAmount)),
        },
      });
      await tx.refund.update({
        where: { id: refundId },
        // Release the unique idempotency key so an identical retry doesn't collide.
        data: { status: RefundStatus.FAILED, idempotencyKey: null },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: 'REFUND_FAILED',
          message: 'Refund failed at the payment provider',
        },
      });
    });
  }

  private refundPaymentStatus(refundedTotal: number, total: number): PaymentStatus {
    if (refundedTotal <= 0) return PaymentStatus.SUCCEEDED;
    return refundedTotal >= total
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;
  }

  async createReturn(id: string, dto: CreateReturnDto, actorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const itemIds = new Set(order.items.map((item) => item.id));
    for (const requested of dto.items) {
      if (!itemIds.has(requested.orderItemId)) {
        throw new BadRequestException('Return references an item not on this order');
      }
    }

    const created = await this.prisma.return.create({
      data: {
        orderId: order.id,
        reason: dto.reason,
        note: dto.note,
        items: {
          create: dto.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });
    await this.prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: 'RETURN_REQUESTED',
        message: dto.reason ?? 'Return requested',
      },
    });
    await this.audit(actorId, 'order.return_requested', order.id, {
      returnId: created.id,
    });
    return created;
  }

  private async audit(
    actorId: string | undefined,
    action: string,
    entityId: string,
    data: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorId, action, entityType: 'order', entityId, data },
    });
  }
}
