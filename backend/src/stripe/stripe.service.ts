import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeConfig } from '../config/configuration';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe;
  private readonly config: StripeConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<StripeConfig>('stripe');
    this.client = new Stripe(this.config.secretKey || 'sk_test_unconfigured', {
      apiVersion: '2024-06-20',
    });
  }

  get currency(): string {
    return this.config.currency;
  }

  get isConfigured(): boolean {
    return Boolean(this.config.secretKey);
  }

  async createPaymentIntent(params: {
    amount: number;
    orderId: string;
    customerEmail: string;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.create(
      {
        amount: params.amount,
        currency: this.config.currency,
        receipt_email: params.customerEmail,
        automatic_payment_methods: { enabled: true },
        metadata: { orderId: params.orderId },
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.retrieve(id);
  }

  async cancelPaymentIntent(id: string): Promise<void> {
    try {
      await this.client.paymentIntents.cancel(id);
    } catch (error) {
      // Already captured/cancelled or unknown — nothing to undo.
      this.logger.warn(`PaymentIntent cancel skipped (${id}): ${(error as Error).message}`);
    }
  }

  async refund(
    paymentIntentId: string,
    amount: number | undefined,
    idempotencyKey: string,
    metadata: Record<string, string> = {},
  ): Promise<Stripe.Refund> {
    return this.client.refunds.create(
      { payment_intent: paymentIntentId, amount, metadata },
      { idempotencyKey },
    );
  }

  async findRefundByMetadata(
    paymentIntentId: string,
    refundId: string,
  ): Promise<Stripe.Refund | null> {
    const refunds = await this.client.refunds.list({
      payment_intent: paymentIntentId,
      limit: 100,
    });
    return refunds.data.find((refund) => refund.metadata?.refundId === refundId) ?? null;
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.config.webhookSecret,
    );
  }
}
