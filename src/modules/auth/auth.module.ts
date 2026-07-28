import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './controllers/auth.controller';
import { RegistrationService } from './services/registration.service';
import { InvitationService } from './services/invitation.service';
import { PasswordService } from './services/password.service';
import { LoginService } from './services/login.service';
import { PasswordResetService } from './services/password-reset.service';
import { OtpLoginService } from './services/otp-login.service';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { LoginOtpRepository } from './repositories/login-otp.repository';
import { SessionRepository } from './repositories/session.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';

import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InvitationsModule } from '../invitations/invitations.module';

import { AuthCookieService } from './services/auth-cookie.service';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    InvitationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret') || 'aditya-jwt',
        signOptions: {
          expiresIn: (configService.get<string>('auth.jwtAccessTokenExpiresIn') || '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegistrationService,
    InvitationService,
    PasswordService,
    LoginService,
    PasswordResetService,
    OtpLoginService,
    AuthService,
    TokenService,
    AuthCookieService,
    JwtStrategy,
    PasswordResetTokenRepository,
    LoginOtpRepository,
    SessionRepository,
    RefreshTokenRepository,
  ],
  exports: [
    RegistrationService,
    InvitationService,
    PasswordService,
    LoginService,
    PasswordResetService,
    OtpLoginService,
    AuthService,
    TokenService,
    AuthCookieService,
    JwtStrategy,
    PasswordResetTokenRepository,
    LoginOtpRepository,
    SessionRepository,
    RefreshTokenRepository,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
