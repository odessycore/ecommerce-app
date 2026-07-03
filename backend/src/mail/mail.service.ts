import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MailConfig, AppConfig } from '../config/configuration';
import { renderVerificationEmail } from './templates/verification-email';
import { renderPasswordResetEmail } from './templates/password-reset-email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly mail: MailConfig;
  private readonly app: AppConfig;

  constructor(private readonly config: ConfigService) {
    this.mail = this.config.getOrThrow<MailConfig>('mail');
    this.app = this.config.getOrThrow<AppConfig>('app');
    this.transporter = createTransport({
      host: this.mail.host,
      port: this.mail.port,
      secure: this.mail.secure,
      auth: this.mail.user
        ? { user: this.mail.user, pass: this.mail.password }
        : undefined,
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.app.webAppUrl}/verify-email?token=${token}`;
    await this.send(to, 'Verify your email address', renderVerificationEmail(link));
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.app.webAppUrl}/reset-password?token=${token}`;
    await this.send(to, 'Reset your password', renderPasswordResetEmail(link));
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.mail.from, to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send "${subject}" to ${to}`, error as Error);
      throw error;
    }
  }
}
