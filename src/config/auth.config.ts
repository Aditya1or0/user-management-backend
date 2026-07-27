import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  jwtSecret: process.env.JWT_SECRET || 'aditya-jwt',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  invitationExpiresInDays: parseInt(process.env.INVITATION_EXPIRES_IN_DAYS || '7', 10),
  passwordResetExpiresInMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES || '60', 10),
  otpExpiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10', 10),
  loginOtpExpiresInMinutes: parseInt(process.env.LOGIN_OTP_EXPIRES_IN_MINUTES || '10', 10),
  jwtAccessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME || 'refresh_token',
  cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.AUTH_COOKIE_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
}));
