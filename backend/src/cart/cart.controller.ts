import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CartContext, CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

const GUEST_TOKEN_HEADER = 'x-cart-token';

@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers(GUEST_TOKEN_HEADER) guestToken?: string,
  ) {
    return this.cart.getCart(this.context(user, guestToken));
  }

  // Used after OAuth sign-in, where the guest token can't ride along on the redirect.
  @Post('merge')
  async merge(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers(GUEST_TOKEN_HEADER) guestToken?: string,
  ) {
    if (!user) throw new UnauthorizedException();
    if (guestToken) await this.cart.mergeGuestCartIntoUser(guestToken, user.id);
    return this.cart.getCart({ userId: user.id });
  }

  @Post('items')
  addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers(GUEST_TOKEN_HEADER) guestToken?: string,
  ) {
    return this.cart.addItem(this.context(user, guestToken), dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers(GUEST_TOKEN_HEADER) guestToken?: string,
  ) {
    return this.cart.updateItem(this.context(user, guestToken), id, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers(GUEST_TOKEN_HEADER) guestToken?: string,
  ) {
    return this.cart.removeItem(this.context(user, guestToken), id);
  }

  private context(
    user: AuthenticatedUser | undefined,
    guestToken?: string,
  ): CartContext {
    return user ? { userId: user.id } : { guestToken };
  }
}
