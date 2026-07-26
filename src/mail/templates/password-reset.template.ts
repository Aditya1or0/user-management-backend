import { PasswordResetEmailData } from '../interfaces/mail-job.interface';

export function renderPasswordResetTemplate(data: PasswordResetEmailData): { subject: string; html: string; text: string } {
  const name = data.firstName || 'User';
  const dateObj = typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
  const expiryFormatted = dateObj.toUTCString();

  const subject = 'Reset Your Nimbus Password';

  const otpSection = data.otp ? `
    <div style="background-color: #18181b; border: 1px solid #27272a; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #a1a1aa;">Alternatively, use this 6-digit OTP code:</p>
      <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #06b6d4;">${data.otp}</div>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; }
    .container { max-width: 580px; margin: 40px auto; background-color: #121215; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; }
    .header { padding: 32px 32px 24px; border-bottom: 1px solid #27272a; text-align: left; }
    .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #06b6d4; text-decoration: none; }
    .content { padding: 32px; line-height: 1.6; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 16px; }
    .text { font-size: 15px; color: #a1a1aa; margin: 0 0 24px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #06b6d4; color: #000000; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.25); }
    .security-notice { background-color: #1c1917; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin: 24px 0; font-size: 13px; color: #d4d4d8; }
    .fallback { font-size: 12px; color: #71717a; word-break: break-all; margin-top: 24px; }
    .footer { padding: 24px 32px; background-color: #09090b; border-top: 1px solid #27272a; font-size: 12px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡ Nimbus Access Console</div>
    </div>
    <div class="content">
      <h1 class="title">Password Reset Request</h1>
      <p class="text">Hi ${name},</p>
      <p class="text">We received a request to reset the password for your Nimbus account. Click the button below to choose a new password:</p>

      <div class="btn-container">
        <a href="${data.resetUrl}" class="btn" target="_blank">Reset Password</a>
      </div>

      ${otpSection}

      <div class="security-notice">
        <strong>Security Notice:</strong> This reset link will expire on <strong>${expiryFormatted}</strong>. If you did not request a password reset, no action is needed and your account remains secure.
      </div>

      <div class="fallback">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><a href="${data.resetUrl}" style="color: #06b6d4;">${data.resetUrl}</a></p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">Automated security notification from Nimbus Access Console.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Nimbus Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `Hi ${name},\n\n` +
    `We received a request to reset your password for your Nimbus account.\n\n` +
    `Reset link:\n${data.resetUrl}\n\n` +
    (data.otp ? `OTP Code: ${data.otp}\n\n` : '') +
    `This link expires on ${expiryFormatted}.\n` +
    `If you did not request this, please ignore this email.`;

  return { subject, html, text };
}
