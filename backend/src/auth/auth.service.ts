import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, User, VerificationPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { JwtConfig } from '../config/configuration';
import { generateOpaqueToken, hashToken } from '../common/utils/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/auth-tokens.dto';

interface GoogleProfile {
  email: string;
  providerAccountId: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

const EMAIL_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly tokens: TokenService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.getOrThrow<JwtConfig>('jwt');
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'CUSTOMER',
      },
    });

    await this.issueVerificationEmail(user);
    return { message: 'Account created. Check your email to verify your address.' };
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const record = await this.consumeVerificationToken(
      rawToken,
      VerificationPurpose.EMAIL_VERIFICATION,
    );
    // Activate only a pending invite; never resurrect a suspended/deactivated account.
    await this.prisma.user.updateMany({
      where: { id: record.userId, status: 'INVITED' },
      data: { status: 'ACTIVE' },
    });
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { message: 'Email verified. You can now sign in.' };
  }

  async validateCredentials(dto: LoginDto): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new UnauthorizedException('This account is not active');
    }
    await this.touchLastLogin(user.id);
    return user;
  }

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linked) {
      await this.touchLastLogin(linked.userId);
      return linked.user;
    }

    const user = await this.prisma.user.upsert({
      where: { email: profile.email },
      update: {
        emailVerifiedAt: new Date(),
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      },
      create: {
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        role: 'CUSTOMER',
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.oAuthAccount.create({
      data: {
        provider: AuthProvider.GOOGLE,
        providerAccountId: profile.providerAccountId,
        userId: user.id,
      },
    });
    return user;
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.passwordHash) {
      const token = await this.createVerificationToken(
        user.id,
        VerificationPurpose.PASSWORD_RESET,
        RESET_TOKEN_TTL_HOURS,
      );
      await this.jobs.sendPasswordResetEmail(user.email, token);
    }
    // Always return success to avoid leaking which emails are registered.
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this.consumeVerificationToken(
      dto.token,
      VerificationPurpose.PASSWORD_RESET,
    );
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await argon2.hash(dto.password) },
    });
    // Invalidate every existing session so a stolen refresh token can't survive a reset.
    await this.tokens.revokeAllForUser(record.userId);
    return { message: 'Password updated. You can now sign in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.issueVerificationEmail(user);
    }
    return { message: 'If that account needs verification, a new link has been sent.' };
  }

  private async issueVerificationEmail(user: User): Promise<void> {
    const token = await this.createVerificationToken(
      user.id,
      VerificationPurpose.EMAIL_VERIFICATION,
      EMAIL_TOKEN_TTL_HOURS,
    );
    await this.jobs.sendVerificationEmail(user.email, token);
  }

  private async createVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
    ttlHours: number,
  ): Promise<string> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.prisma.verificationToken.create({
      data: { tokenHash: hashToken(token), purpose, userId, expiresAt },
    });
    return token;
  }

  // Atomic single-use consumption: the conditional updateMany guarantees a token can be
  // redeemed exactly once even under concurrent requests.
  private async consumeVerificationToken(
    rawToken: string,
    purpose: VerificationPurpose,
  ): Promise<{ userId: string }> {
    const tokenHash = hashToken(rawToken);
    const consumed = await this.prisma.verificationToken.updateMany({
      where: {
        tokenHash,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    const record = await this.prisma.verificationToken.findUniqueOrThrow({
      where: { tokenHash },
    });
    return { userId: record.userId };
  }

  private async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
