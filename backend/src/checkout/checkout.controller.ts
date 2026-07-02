import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { StripeService } from '../stripe/stripe.service';
import { CartContext } from '../cart/cart.service';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly stripe: StripeService,
  ) {}

  @Public()
  @Post()
  create(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers('x-cart-token') guestToken?: string,
  ) {
    const ctx: CartContext = user ? { userId: user.id } : { guestToken };
    return this.checkout.checkout(ctx, dto);
  }

  @Public()
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Missing webhook payload');
    const event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    await this.checkout.handleStripeEvent(event);
    return { received: true };
  }
}
