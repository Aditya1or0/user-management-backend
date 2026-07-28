import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER || '',
  pass: process.env.MAIL_PASSWORD || process.env.MAIL_PASS || '',
  from: process.env.MAIL_FROM || 'KeyMaster <noreply@keymaster.io>',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
