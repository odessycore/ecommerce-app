import { emailButton, emailLayout } from './layout';

export function renderPasswordResetEmail(link: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:20px;color:#fafafa;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a3a3a3;">
      We received a request to reset your password. This link expires in 1 hour.
      If you didn't request this, you can safely ignore this email.
    </p>
    ${emailButton('Reset password', link)}
  `);
}
