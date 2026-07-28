import { PasswordResetEmailData } from '../interfaces/mail-job.interface';

export function renderPasswordSetupTemplate(data: PasswordResetEmailData): { subject: string; html: string; text: string } {
  const inviter = data.inviterName || 'A team member';
  const org = data.organizationName || 'KeyMaster Workspace';
  const name = data.firstName || 'User';
  const dateObj = typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
  const expiryFormatted = dateObj.toUTCString();

  const subject = `Welcome to ${org} on KeyMaster - Setup Your Password`;

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
    .highlight-box { background-color: #ecfeff; border: 1px solid #cffafe; padding: 16px; border-radius: 8px; margin: 0 0 24px; }
    .highlight-text { margin: 0; font-size: 14px; color: #1f2937; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #0891b2; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(8, 145, 178, 0.25); }
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
      <h1 class="title">Workspace Invitation</h1>
      <p class="text">Hello ${name},</p>
      <p class="text"><strong>${inviter}</strong> has invited you to join the <strong>${org}</strong> workspace on KeyMaster.</p>
      
      <div class="highlight-box">
        <p class="highlight-text"><strong>Organization:</strong> ${org}</p>
        <p class="highlight-text" style="margin-top: 4px;"><strong>Setup Link Expires:</strong> ${expiryFormatted}</p>
      </div>

      <div class="btn-container">
        <a href="${data.resetUrl}" class="btn" style="color: #ffffff;" target="_blank">Setup Password</a>
      </div>

      <p class="text">Clicking the button above will take you to the password setup page to complete your account activation.</p>

      <div class="fallback">
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><a href="${data.resetUrl}" style="color: #06b6d4;">${data.resetUrl}</a></p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">If you were not expecting this invitation, you can safely ignore this email.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} KeyMaster Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `You've been invited to join ${org} on KeyMaster.\n\n` +
    `${inviter} has invited you to join the ${org} workspace.\n\n` +
    `Setup your password here:\n${data.resetUrl}\n\n` +
    `This setup link expires on ${expiryFormatted}.`;

  return { subject, html, text };
}
