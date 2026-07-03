import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CheckoutConfig } from '../config/configuration';
import { OrdersService } from './orders.service';

@Injectable()
export class OrderMaintenanceScheduler {
  private readonly logger = new Logger(OrderMaintenanceScheduler.name);
  private running = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleOrders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const ttl = this.config.getOrThrow<CheckoutConfig>('checkout').reservationTtlMinutes;
      const expired = await this.orders.expireStalePendingOrders(ttl);
      if (expired > 0) this.logger.log(`Expired ${expired} stale pending order(s)`);
    } catch (error) {
      this.logger.error('Stale-order sweep failed', error as Error);
    } finally {
      this.running = false;
    }
  }
}
