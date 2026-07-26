import { Module } from '@nestjs/common';
import { InvitationsController } from './controllers/invitations.controller';
import { InvitationsManagementService } from './services/invitations-management.service';
import { InvitationRepository } from './repositories/invitation.repository';
import { UsersModule } from '../users/users.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [UsersModule, OrganizationsModule],
  controllers: [InvitationsController],
  providers: [InvitationsManagementService, InvitationRepository],
  exports: [InvitationsManagementService, InvitationRepository],
})
export class InvitationsModule {}
