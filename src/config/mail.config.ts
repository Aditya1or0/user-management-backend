import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.MAIL_PORT || '2525', 10),
  user: process.env.MAIL_USER || '',
  pass: process.env.MAIL_PASS || '',
  from: process.env.MAIL_FROM || 'noreply@saasapp.com',
}));
