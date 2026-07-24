import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  jwtSecret: process.env.JWT_SECRET || 'aditya-jwt',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
}));
