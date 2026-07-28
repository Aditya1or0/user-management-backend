import { PasswordResetEmailData } from '../interfaces/mail-job.interface';

export function renderPasswordResetTemplate(data: PasswordResetEmailData): { subject: string; html: string; text: string } {
  const name = data.firstName || 'User';
  const dateObj = typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
  const expiryFormatted = dateObj.toUTCString();

  const subject = 'Reset Your KeyMaster Password';

  const otpSection = data.otp ? `
    <div style="background-color: #ecfeff; border: 1px solid #cffafe; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #4b5563;">Alternatively, use this 6-digit OTP code:</p>
      <div style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0891b2;">${data.otp}</div>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #374151; }
    .container { max-width: 580px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { padding: 32px 32px 24px; border-bottom: 1px solid #f3f4f6; text-align: left; }
    .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #0891b2; text-decoration: none; }
    .content { padding: 32px; line-height: 1.6; }
    .title { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .text { font-size: 15px; color: #4b5563; margin: 0 0 24px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #0891b2; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(8, 145, 178, 0.25); }
    .security-notice { background-color: #fffbeb; border: 1px solid #fde68a; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 13px; color: #92400e; }
    .fallback { font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 24px; }
    .footer { padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span style="color: #0891b2;">⌘</span> <span style="color: #374151;">KeyMaster</span></div>
    </div>
    <div class="content">
      <h1 class="title">Password Reset Request</h1>
      <p class="text">Hi ${name},</p>
      <p class="text">We received a request to reset the password for your KeyMaster account. Click the button below to choose a new password:</p>

      <div class="btn-container">
        <a href="${data.resetUrl}" class="btn" style="color: #ffffff;" target="_blank">Reset Password</a>
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
      <p style="margin: 0 0 8px;">Automated security notification from KeyMaster.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} KeyMaster Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `Hi ${name},\n\n` +
    `We received a request to reset your password for your KeyMaster account.\n\n` +
    `Reset link:\n${data.resetUrl}\n\n` +
    (data.otp ? `OTP Code: ${data.otp}\n\n` : '') +
    `This link expires on ${expiryFormatted}.\n` +
    `If you did not request this, please ignore this email.`;

  return { subject, html, text };
}
