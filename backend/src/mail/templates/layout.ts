export function emailLayout(content: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #262626;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #262626;">
                <span style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#fafafa;">ACME</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${content}</td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #262626;font-size:12px;color:#737373;">
                You received this email because an action was requested for your account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#fafafa;color:#0a0a0a;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px;">${label}</a>`;
}
