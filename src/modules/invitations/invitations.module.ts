import { Module } from '@nestjs/common';
import { InvitationRepository } from './repositories/invitation.repository';

@Module({
  providers: [InvitationRepository],
  exports: [InvitationRepository],
})
export class InvitationsModule {}
