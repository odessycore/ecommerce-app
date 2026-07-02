import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CartModule } from '../cart/cart.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), CartModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
