import { forwardRef, Module } from '@nestjs/common';
import { OrganizationRepository } from './repositories/organization.repository';
import { OrganizationUserRepository } from './repositories/organization-user.repository';
import { RoleProvisioningService } from './services/role-provisioning.service';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [forwardRef(() => RolesModule)],
  providers: [
    OrganizationRepository,
    OrganizationUserRepository,
    RoleProvisioningService,
  ],
  exports: [
    OrganizationRepository,
    OrganizationUserRepository,
    RoleProvisioningService,
  ],
})
export class OrganizationsModule {}
