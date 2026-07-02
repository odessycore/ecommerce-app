import { BadRequestException, Injectable } from '@nestjs/common';
import { Order, Payment, PaymentStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from '../orders/orders.service';
import { CartContext } from '../cart/cart.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CheckoutDto } from './dto/checkout.dto';

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  clientSecret: string | null;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
    private readonly analytics: AnalyticsService,
  ) {}

  // Idempotent per cart: a cart maps to at most one order (enforced by a unique
  // constraint), so repeated checkout calls resume the same PaymentIntent rather than
  // creating duplicate orders or charges.
  async checkout(ctx: CartContext, dto: CheckoutDto): Promise<CheckoutResult> {
    const cart = await this.resolveCart(ctx);

    const existing = await this.prisma.order.findUnique({
      where: { cartId: cart.id },
      include: { payments: true },
    });
    if (existing) return this.resumeOrder(existing, existing.payments, dto.email);

    try {
      return await this.startOrder(cart.id, ctx.userId, dto);
    } catch (error) {
      // Lost a concurrent race for the same cart — resume the order the winner created.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const order = await this.prisma.order.findUniqueOrThrow({
          where: { cartId: cart.id },
          include: { payments: true },
        });
        return this.resumeOrder(order, order.payments, dto.email);
      }
      throw error;
    }
  }

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    const alreadyHandled = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'stripe', eventId: event.id } },
    });
    if (alreadyHandled) return;

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.orders.markPaidByPaymentIntent(intent.id);
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.orders.markPaymentFailed(intent.id);
    }

    await this.prisma.webhookEvent
      .create({ data: { provider: 'stripe', eventId: event.id, type: event.type } })
      .catch((error) => {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
      });
  }

  private async startOrder(
    cartId: string,
    userId: string | undefined,
    dto: CheckoutDto,
  ): Promise<CheckoutResult> {
    const order = await this.orders.createDraftFromCart({
      cartId,
      userId,
      email: dto.email,
      shippingAddress: dto.shippingAddress as unknown as Prisma.InputJsonValue,
      billingAddress: (dto.billingAddress ??
        dto.shippingAddress) as unknown as Prisma.InputJsonValue,
      customerNote: dto.note,
    });

    // Always persist the payment row first so a later PaymentIntent failure can't strand
    // the order; attach the provider reference once Stripe is involved.
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        amount: order.totalAmount,
        currency: order.currency,
      },
    });
    const clientSecret = await this.attachPaymentIntent(
      order.id,
      payment.id,
      order.totalAmount,
      dto.email,
    );

    await this.analytics.track({
      type: 'CHECKOUT_STARTED',
      userId,
      data: { orderId: order.id, amount: order.totalAmount },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      currency: order.currency,
      clientSecret,
    };
  }

  private async resumeOrder(
    order: Order,
    payments: Payment[],
    email: string,
  ): Promise<CheckoutResult> {
    if (order.paymentStatus === PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('This order has already been paid');
    }

    let clientSecret: string | null = null;
    const withRef = payments.find((p) => p.providerRef);
    if (withRef?.providerRef) {
      const intent = await this.stripe.retrievePaymentIntent(withRef.providerRef);
      clientSecret = intent.client_secret;
    } else {
      // PaymentIntent was never created (Stripe unconfigured earlier, or a prior failure).
      clientSecret = await this.attachPaymentIntent(
        order.id,
        payments[0]?.id,
        order.totalAmount,
        email,
      );
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      currency: order.currency,
      clientSecret,
    };
  }

  // Creates the Stripe PaymentIntent (idempotent per order) and links it to the payment
  // row. Returns null when Stripe isn't configured — the storefront then runs its demo
  // completion so checkout stays exercisable without keys.
  private async attachPaymentIntent(
    orderId: string,
    paymentId: string | undefined,
    amount: number,
    email: string,
  ): Promise<string | null> {
    if (!this.stripe.isConfigured) return null;

    const intent = await this.stripe.createPaymentIntent({
      amount,
      orderId,
      customerEmail: email,
      idempotencyKey: `pi:${orderId}`,
    });
    if (paymentId) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { providerRef: intent.id },
      });
    } else {
      await this.prisma.payment.create({
        data: { orderId, provider: 'stripe', providerRef: intent.id, amount },
      });
    }
    return intent.client_secret;
  }

  private async resolveCart(ctx: CartContext) {
    if (!ctx.userId && !ctx.guestToken) {
      throw new BadRequestException('Your cart is empty');
    }
    const cart = ctx.userId
      ? await this.prisma.cart.findFirst({
          where: { userId: ctx.userId, status: 'ACTIVE' },
          include: { items: true },
        })
      : await this.prisma.cart.findFirst({
          where: { guestToken: ctx.guestToken, status: 'ACTIVE' },
          include: { items: true },
        });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }
    return cart;
  }
}
