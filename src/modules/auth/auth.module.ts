import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './controllers/auth.controller';
import { RegistrationService } from './services/registration.service';
import { InvitationService } from './services/invitation.service';
import { PasswordService } from './services/password.service';
import { LoginService } from './services/login.service';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InvitationsModule } from '../invitations/invitations.module';

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
          expiresIn: (configService.get<string>('auth.jwtExpiresIn') || '1d') as any,
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
    AuthService,
    JwtStrategy,
  ],
  exports: [
    RegistrationService,
    InvitationService,
    PasswordService,
    LoginService,
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
