import { WelcomeEmailData } from '../interfaces/mail-job.interface';

export function renderWelcomeTemplate(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const name = data.firstName || 'User';
  const org = data.organizationName ? ` to ${data.organizationName}` : '';
  const subject = `Welcome${org} on KeyMaster!`;

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
    .btn { display: inline-block; background-color: #0891b2; color: #ffffff; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(8, 145, 178, 0.25); }
    .feature-list { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0; list-style: none; }
    .feature-item { font-size: 14px; color: #4b5563; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .feature-item:last-child { margin-bottom: 0; }
    .footer { padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span style="color: #0891b2;">⌘</span> <span style="color: #374151;">KeyMaster</span></div>
    </div>
    <div class="content">
      <h1 class="title">Welcome aboard, ${name}!</h1>
      <p class="text">Your workspace account has been successfully created and configured.</p>
      
      ${data.organizationName ? `<p class="text">You are now a member of <strong>${data.organizationName}</strong>.</p>` : ''}

      <div class="feature-list">
        <div class="feature-item">✓ Granular access control & role management</div>
        <div class="feature-item">✓ Real-time audit logs & security tracking</div>
        <div class="feature-item">✓ Multi-tenant organization workspace support</div>
      </div>

      <div class="btn-container">
        <a href="${data.loginUrl}" class="btn" style="color: #ffffff;" target="_blank">Access Console Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">Need help getting started? Contact your system administrator.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} KeyMaster Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `Welcome aboard, ${name}!\n\n` +
    `Your workspace account on KeyMaster has been successfully created.\n` +
    (data.organizationName ? `Organization: ${data.organizationName}\n\n` : '\n') +
    `Access your dashboard here:\n${data.loginUrl}`;

  return { subject, html, text };
}
