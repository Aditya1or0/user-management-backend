import { Module } from '@nestjs/common';
import { RegisterController } from './controllers/register.controller';
import { RegistrationService } from './services/registration.service';
import { InvitationService } from './services/invitation.service';
import { PasswordService } from './services/password.service';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InvitationsModule } from '../invitations/invitations.module';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    InvitationsModule,
  ],
  controllers: [RegisterController],
  providers: [
    RegistrationService,
    InvitationService,
    PasswordService,
  ],
  exports: [
    RegistrationService,
    InvitationService,
    PasswordService,
  ],
})
export class AuthModule {}
