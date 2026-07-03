import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RefundReconciliationScheduler } from './refund-reconciliation.scheduler';
import { OrderMaintenanceScheduler } from './order-maintenance.scheduler';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, RefundReconciliationScheduler, OrderMaintenanceScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
