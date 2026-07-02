import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [revenue, orderCount, customerCount, productCount, recentOrders] =
      await this.prisma.$transaction([
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { paymentStatus: PaymentStatus.SUCCEEDED },
        }),
        this.prisma.order.count(),
        this.prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null } }),
        this.prisma.product.count({ where: { deletedAt: null } }),
        this.prisma.order.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            email: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      grossRevenue: revenue._sum.totalAmount ?? 0,
      orderCount,
      customerCount,
      productCount,
      pendingOrders: await this.prisma.order.count({
        where: { status: OrderStatus.PAID, fulfillmentStatus: 'UNFULFILLED' },
      }),
      recentOrders,
    };
  }
}
