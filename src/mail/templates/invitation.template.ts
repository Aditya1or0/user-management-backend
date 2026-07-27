import { InvitationEmailData } from '../interfaces/mail-job.interface';

export function renderInvitationTemplate(data: InvitationEmailData): { subject: string; html: string; text: string } {
  const inviter = data.inviterName || 'A team member';
  const org = data.organizationName || 'Nimbus Workspace';
  const dateObj = typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : data.expiresAt;
  const expiryFormatted = dateObj.toUTCString();

  const subject = `You've been invited to join ${org} on Nimbus`;

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
    .highlight-box { background-color: #18181b; border-left: 4px solid #06b6d4; padding: 16px; border-radius: 6px; margin: 0 0 24px; }
    .highlight-text { margin: 0; font-size: 14px; color: #e4e4e7; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #06b6d4; color: #000000; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.25); }
    .fallback { font-size: 12px; color: #71717a; word-break: break-all; margin-top: 24px; }
    .footer { padding: 24px 32px; background-color: #09090b; border-top: 1px solid #27272a; font-size: 12px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡ KeyMaster</div>
    </div>
    <div class="content">
      <h1 class="title">Workspace Invitation</h1>
      <p class="text">Hello,</p>
      <p class="text"><strong>${inviter}</strong> has invited you to join the <strong>${org}</strong> workspace on KeyMaster.</p>
      
      <div class="highlight-box">
        <p class="highlight-text"><strong>Organization:</strong> ${org}</p>
        <p class="highlight-text" style="margin-top: 4px;"><strong>Expires:</strong> ${expiryFormatted}</p>
      </div>

      <div class="btn-container">
        <a href="${data.invitationUrl}" class="btn" target="_blank">Accept Invitation</a>
      </div>

      <p class="text">Clicking the button above will take you to the invitation acceptance page to complete setting up your account.</p>

      <div class="fallback">
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><a href="${data.invitationUrl}" style="color: #06b6d4;">${data.invitationUrl}</a></p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">If you were not expecting this invitation, you can safely ignore this email.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Nimbus Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `You've been invited to join ${org} on Nimbus.\n\n` +
    `${inviter} has invited you to join the ${org} workspace.\n\n` +
    `Accept your invitation here:\n${data.invitationUrl}\n\n` +
    `This invitation expires on ${expiryFormatted}.`;

  return { subject, html, text };
}
