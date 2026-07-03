import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import {
  CreateReturnDto,
  OrderQueryDto,
  RefundOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles(Role.ADMIN)
  @Get('admin/orders')
  findForAdmin(@Query() query: OrderQueryDto) {
    return this.orders.findManyForAdmin(query);
  }

  @Roles(Role.ADMIN)
  @Get('admin/orders/:id')
  findOneForAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOneForAdmin(id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/orders/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.updateStatus(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/refund')
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.refund(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/returns')
  createReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.createReturn(id, dto, user.id);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get('orders')
  findForCustomer(
    @Query() query: OrderQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.findManyForCustomer(user.id, query);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get('orders/:id')
  findOneForCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.findOneForCustomer(user.id, id);
  }
}
