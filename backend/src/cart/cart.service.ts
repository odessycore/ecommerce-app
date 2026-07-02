import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cart, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { generateOpaqueToken } from '../common/utils/crypto';
import { AddCartItemDto } from './dto/cart.dto';

export interface CartContext {
  userId?: string;
  guestToken?: string;
}

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        include: {
          product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async getCart(ctx: CartContext) {
    const cart = await this.findActiveCart(ctx);
    return cart ? this.serialize(await this.reload(cart.id)) : null;
  }

  async addItem(ctx: CartContext, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, isActive: true },
    });
    if (!variant) throw new NotFoundException('Product variant not found');
    if (variant.inventoryQuantity - variant.reservedQuantity < dto.quantity) {
      throw new BadRequestException('Not enough inventory available');
    }

    const cart = await this.resolveOrCreateCart(ctx);
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      create: {
        cartId: cart.id,
        variantId: variant.id,
        quantity: dto.quantity,
        unitAmount: variant.priceAmount,
      },
      update: {
        quantity: { increment: dto.quantity },
        unitAmount: variant.priceAmount,
      },
    });
    await this.analytics.track({
      type: 'CART_ITEM_ADDED',
      userId: ctx.userId,
      anonymousId: ctx.guestToken,
      productId: variant.productId,
      variantId: variant.id,
      data: { quantity: dto.quantity },
    });
    return this.serialize(await this.reload(cart.id));
  }

  async updateItem(ctx: CartContext, itemId: string, quantity: number) {
    const cart = await this.requireActiveCart(ctx);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    return this.serialize(await this.reload(cart.id));
  }

  async removeItem(ctx: CartContext, itemId: string) {
    const cart = await this.requireActiveCart(ctx);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.serialize(await this.reload(cart.id));
  }

  // When a guest with a cart signs in, fold their cart into the user account.
  async mergeGuestCartIntoUser(guestToken: string, userId: string): Promise<void> {
    const guestCart = await this.prisma.cart.findFirst({
      where: { guestToken, status: 'ACTIVE' },
      include: { items: true },
    });
    if (!guestCart || guestCart.items.length === 0) return;

    const userCart = await this.resolveOrCreateCart({ userId });
    for (const item of guestCart.items) {
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        create: {
          cartId: userCart.id,
          variantId: item.variantId,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
        },
        update: { quantity: { increment: item.quantity } },
      });
    }
    await this.prisma.cart.update({
      where: { id: guestCart.id },
      data: { status: 'ABANDONED' },
    });
  }

  private async resolveOrCreateCart(ctx: CartContext): Promise<Cart> {
    const existing = await this.findActiveCart(ctx);
    if (existing) return existing;
    return this.prisma.cart.create({
      data: ctx.userId
        ? { userId: ctx.userId }
        : { guestToken: ctx.guestToken ?? generateOpaqueToken(24) },
    });
  }

  private async requireActiveCart(ctx: CartContext): Promise<Cart> {
    const cart = await this.findActiveCart(ctx);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  private async findActiveCart(ctx: CartContext) {
    if (ctx.userId) {
      return this.prisma.cart.findFirst({
        where: { userId: ctx.userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (ctx.guestToken) {
      return this.prisma.cart.findFirst({
        where: { guestToken: ctx.guestToken, status: 'ACTIVE' },
      });
    }
    return null;
  }

  private reload(cartId: string) {
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }

  private serialize(cart: Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>) {
    const items = cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      lineTotal: item.unitAmount * item.quantity,
      name: item.variant.product.name,
      variantName: item.variant.name,
      sku: item.variant.sku,
      imageUrl: item.variant.product.images[0]?.url ?? null,
      availableQuantity: item.variant.inventoryQuantity - item.variant.reservedQuantity,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return {
      id: cart.id,
      token: cart.guestToken,
      currency: cart.currency,
      items,
      subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }
}
