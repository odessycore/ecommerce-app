import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleConfig } from '../../config/configuration';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private readonly authService: AuthService) {
    const google = config.getOrThrow<GoogleConfig>('google');
    super({
      clientID: google.clientId || 'google-client-id-not-configured',
      clientSecret: google.clientSecret || 'google-client-secret-not-configured',
      callbackURL: google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account has no email'), undefined);
      return;
    }
    const user = await this.authService.findOrCreateGoogleUser({
      email,
      providerAccountId: profile.id,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, user);
  }
}
