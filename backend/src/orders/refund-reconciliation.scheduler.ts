import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class RefundReconciliationScheduler {
  private readonly logger = new Logger(RefundReconciliationScheduler.name);
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.orders.reconcilePendingRefunds();
    } catch (error) {
      this.logger.error('Refund reconciliation sweep failed', error as Error);
    } finally {
      this.running = false;
    }
  }
}
