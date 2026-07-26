import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  jwtSecret: process.env.JWT_SECRET || 'aditya-jwt',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  invitationExpiresInDays: parseInt(process.env.INVITATION_EXPIRES_IN_DAYS || '7', 10),
  passwordResetExpiresInMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES || '60', 10),
  otpExpiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10', 10),
  loginOtpExpiresInMinutes: parseInt(process.env.LOGIN_OTP_EXPIRES_IN_MINUTES || '10', 10),
}));
