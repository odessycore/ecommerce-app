import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { AppConfig, JwtConfig } from '../config/configuration';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AuthService } from './auth.service';
import { TokenService, IssuedTokens } from './token.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth-tokens.dto';

@Controller('auth')
export class AuthController {
  private readonly jwtConfig: JwtConfig;
  private readonly appConfig: AppConfig;

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.getOrThrow<JwtConfig>('jwt');
    this.appConfig = config.getOrThrow<AppConfig>('app');
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  resendVerification(@Body() dto: RequestPasswordResetDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-cart-token') guestToken?: string,
  ) {
    const user = await this.authService.validateCredentials(dto);
    if (guestToken) await this.cart.mergeGuestCartIntoUser(guestToken, user.id);
    return this.respondWithSession(user, req, res);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[this.jwtConfig.refreshCookie];
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');

    const result = await this.tokenService.rotateRefreshToken(rawToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, result);
    return { accessToken: result.accessToken, user: this.toPublicUser(result.user) };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[this.jwtConfig.refreshCookie];
    if (rawToken) await this.tokenService.revokeRefreshToken(rawToken);
    this.clearRefreshCookie(res);
    return { message: 'Signed out' };
  }

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.id },
    });
    return this.toPublicUser(user);
  }

  @Public()
  @Post('password/forgot')
  forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Passport handles the redirect to Google's consent screen.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = req.user as User;
    const tokens = await this.tokenService.issueTokenPair(user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, tokens);
    res.redirect(`${this.appConfig.webAppUrl}/auth/callback`);
  }

  private async respondWithSession(user: User, req: Request, res: Response) {
    const tokens = await this.tokenService.issueTokenPair(user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken, user: this.toPublicUser(user) };
  }

  private setRefreshCookie(res: Response, tokens: IssuedTokens): void {
    res.cookie(this.jwtConfig.refreshCookie, tokens.refreshToken, {
      httpOnly: true,
      secure: this.appConfig.env === 'production',
      sameSite: 'lax',
      expires: tokens.refreshExpiresAt,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.jwtConfig.refreshCookie, { path: '/' });
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
