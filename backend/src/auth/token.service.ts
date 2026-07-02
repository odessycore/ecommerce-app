import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken, User } from '@prisma/client';
import { JwtConfig } from '../config/configuration';
import { generateOpaqueToken, hashToken } from '../common/utils/crypto';
import { JwtPayload } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.getOrThrow<JwtConfig>('jwt');
  }

  async issueTokenPair(user: User, context: RequestContext): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(user);
    const { token, record } = await this.createRefreshToken(user.id, context);
    return {
      accessToken,
      refreshToken: token,
      refreshExpiresAt: record.expiresAt,
    };
  }

  async rotateRefreshToken(
    rawToken: string,
    context: RequestContext,
  ): Promise<IssuedTokens & { user: User }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      // Reuse of a revoked token signals theft — drop the whole session lineage.
      if (existing?.revokedAt) {
        await this.revokeAllForUser(existing.userId);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { token, record } = await this.createRefreshToken(existing.userId, context);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: record.id },
    });

    return {
      accessToken: this.signAccessToken(existing.user),
      refreshToken: token,
      refreshExpiresAt: record.expiresAt,
      user: existing.user,
    };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.sign(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessTtl,
    });
  }

  private async createRefreshToken(
    userId: string,
    context: RequestContext,
  ): Promise<{ token: string; record: RefreshToken }> {
    const token = generateOpaqueToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.jwtConfig.refreshTtlDays);

    const record = await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt,
      },
    });
    return { token, record };
  }
}
