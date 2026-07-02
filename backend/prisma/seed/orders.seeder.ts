import {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  Prisma,
} from '@prisma/client';
import { VariantRef } from './catalog.seeder';
import { AddressSnapshot, CustomerRef } from './users.seeder';
import { daysAgo, minutesAfter, Rng } from './helpers';

interface OrderSpec {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: FulfillmentStatus;
  itemCount: number;
  daysAgo: number;
  guest?: boolean;
  refundFraction?: number;
  withReturn?: boolean;
}

interface EventInput {
  type: string;
  message: string;
  data?: Prisma.InputJsonValue;
  createdAt: Date;
}

function buildSpecs(rng: Rng): OrderSpec[] {
  const specs: OrderSpec[] = [
    { status: 'PAID', paymentStatus: 'SUCCEEDED', fulfillment: 'UNFULFILLED', itemCount: 2, daysAgo: 1 },
    { status: 'PAID', paymentStatus: 'SUCCEEDED', fulfillment: 'UNFULFILLED', itemCount: 1, daysAgo: 2 },
    { status: 'PAID', paymentStatus: 'SUCCEEDED', fulfillment: 'UNFULFILLED', itemCount: 3, daysAgo: 3 },
    { status: 'PENDING', paymentStatus: 'REQUIRES_PAYMENT', fulfillment: 'UNFULFILLED', itemCount: 2, daysAgo: 0, guest: true },
    { status: 'PENDING', paymentStatus: 'REQUIRES_PAYMENT', fulfillment: 'UNFULFILLED', itemCount: 1, daysAgo: 1 },
    { status: 'CANCELLED', paymentStatus: 'FAILED', fulfillment: 'UNFULFILLED', itemCount: 1, daysAgo: 6 },
    { status: 'COMPLETED', paymentStatus: 'PARTIALLY_REFUNDED', fulfillment: 'FULFILLED', itemCount: 2, daysAgo: 14, refundFraction: 0.5 },
    { status: 'FULFILLED', paymentStatus: 'SUCCEEDED', fulfillment: 'FULFILLED', itemCount: 2, daysAgo: 9, withReturn: true },
  ];

  for (let i = 0; i < 12; i++) {
    specs.push({
      status: rng.bool(0.6) ? 'COMPLETED' : 'FULFILLED',
      paymentStatus: 'SUCCEEDED',
      fulfillment: 'FULFILLED',
      itemCount: rng.int(1, 3),
      daysAgo: rng.int(4, 130),
      guest: rng.bool(0.15),
    });
  }

  return specs;
}

function isCaptured(status: PaymentStatus): boolean {
  return status === 'SUCCEEDED' || status === 'PARTIALLY_REFUNDED';
}

function guestAddress(rng: Rng, index: number): AddressSnapshot {
  return {
    fullName: `Guest Shopper ${index + 1}`,
    line1: `${rng.int(10, 999)} Market Street`,
    city: 'Columbus',
    region: 'OH',
    postalCode: String(rng.int(10000, 99999)),
    country: 'US',
    phone: `+1 (555) 0${rng.int(10, 99)}-${rng.int(1000, 9999)}`,
  };
}

function buildEvents(spec: OrderSpec, createdAt: Date, now: number): EventInput[] {
  const cap = (date: Date) => new Date(Math.min(date.getTime(), now));
  const events: EventInput[] = [
    { type: 'ORDER_CREATED', message: 'Order created at checkout', createdAt },
  ];
  if (isCaptured(spec.paymentStatus)) {
    events.push({ type: 'PAYMENT_SUCCEEDED', message: 'Payment captured', createdAt: cap(minutesAfter(createdAt, 2)) });
  }
  if (spec.paymentStatus === 'FAILED') {
    events.push({ type: 'PAYMENT_FAILED', message: 'Payment was declined', createdAt: cap(minutesAfter(createdAt, 3)) });
  }
  if (spec.fulfillment === 'FULFILLED') {
    events.push({ type: 'STATUS_CHANGED', message: 'Order marked as fulfilled', data: { status: 'FULFILLED' }, createdAt: cap(minutesAfter(createdAt, 60 * 26)) });
  }
  if (spec.status === 'COMPLETED') {
    events.push({ type: 'STATUS_CHANGED', message: 'Order completed', data: { status: 'COMPLETED' }, createdAt: cap(minutesAfter(createdAt, 60 * 72)) });
  }
  if (spec.status === 'CANCELLED') {
    events.push({ type: 'STATUS_CHANGED', message: 'Order cancelled', data: { status: 'CANCELLED' }, createdAt: cap(minutesAfter(createdAt, 30)) });
  }
  return events;
}

export async function seedOrders(
  prisma: PrismaClient,
  rng: Rng,
  now: number,
  context: { adminId: string; variants: VariantRef[]; customers: CustomerRef[] },
): Promise<number> {
  const activeCustomers = context.customers.filter((c) => c.isActive);
  const specs = buildSpecs(rng);

  for (const [index, spec] of specs.entries()) {
    const customer = spec.guest ? null : rng.pick(activeCustomers);
    const email = customer?.email ?? `guest${index + 1}@example.com`;
    const address = customer?.address ?? guestAddress(rng, index);
    const createdAt = daysAgo(now, spec.daysAgo);

    const chosen = rng.sample(context.variants, spec.itemCount);
    const lineItems = chosen.map((variant) => {
      const quantity = rng.int(1, 2);
      return {
        variantId: variant.id,
        productName: variant.productName,
        variantName: variant.variantName,
        sku: variant.sku,
        unitAmount: variant.priceAmount,
        quantity,
        totalAmount: variant.priceAmount * quantity,
      };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const refundedAmount = spec.refundFraction
      ? Math.round(subtotal * spec.refundFraction)
      : 0;

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${10000 + index}`,
        customerId: customer?.id,
        email,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        fulfillmentStatus: spec.fulfillment,
        subtotalAmount: subtotal,
        totalAmount: subtotal,
        refundedAmount,
        shippingAddress: address as unknown as Prisma.InputJsonValue,
        billingAddress: address as unknown as Prisma.InputJsonValue,
        placedAt: isCaptured(spec.paymentStatus) ? createdAt : null,
        cancelledAt: spec.status === 'CANCELLED' ? createdAt : null,
        createdAt,
        items: { create: lineItems },
        events: { create: buildEvents(spec, createdAt, now) },
        payments: {
          create: {
            provider: 'stripe',
            providerRef: `pi_seed_${10000 + index}`,
            status: isCaptured(spec.paymentStatus)
              ? 'SUCCEEDED'
              : spec.paymentStatus,
            amount: subtotal,
            createdAt,
          },
        },
      },
      include: { items: true, payments: true },
    });

    if (isCaptured(spec.paymentStatus)) {
      for (const item of order.items) {
        if (item.variantId) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: { inventoryQuantity: { decrement: item.quantity } },
          });
        }
      }
    }

    if (refundedAmount > 0) {
      const payment = order.payments[0];
      await prisma.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          providerRef: `re_seed_${10000 + index}`,
          idempotencyKey: `refund:${order.id}:0:${refundedAmount}`,
          amount: refundedAmount,
          reason: 'Customer reported a sizing issue',
          status: 'SUCCEEDED',
          createdAt: daysAgo(now, Math.max(0, spec.daysAgo - 2)),
        },
      });
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: 'REFUND_ISSUED',
          message: `Refunded ${refundedAmount} ${order.currency}`,
          data: { amount: refundedAmount },
          createdAt: daysAgo(now, Math.max(0, spec.daysAgo - 2)),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: context.adminId,
          action: 'order.refunded',
          entityType: 'order',
          entityId: order.id,
          data: { amount: refundedAmount },
        },
      });
    }

    if (spec.withReturn) {
      const item = order.items[0];
      await prisma.return.create({
        data: {
          orderId: order.id,
          status: 'RECEIVED',
          reason: 'Did not fit as expected',
          items: { create: [{ orderItemId: item.id, quantity: 1 }] },
          createdAt: daysAgo(now, Math.max(0, spec.daysAgo - 3)),
        },
      });
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: 'RETURN_REQUESTED',
          message: 'Return requested for 1 item',
          createdAt: daysAgo(now, Math.max(0, spec.daysAgo - 3)),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: context.adminId,
          action: 'order.return_requested',
          entityType: 'order',
          entityId: order.id,
        },
      });
    }
  }

  return specs.length;
}
