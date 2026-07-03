import { emailButton, emailLayout } from './layout';

export function renderVerificationEmail(link: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:20px;color:#fafafa;">Confirm your email</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a3a3a3;">
      Thanks for creating an account. Confirm your email address to activate it.
      This link expires in 24 hours.
    </p>
    ${emailButton('Verify email', link)}
    <p style="margin:24px 0 0;font-size:12px;color:#737373;word-break:break-all;">
      Or paste this link into your browser:<br />${link}
    </p>
  `);
}
