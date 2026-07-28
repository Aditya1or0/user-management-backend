import { Global, Module, forwardRef } from '@nestjs/common';
import { TenantOrgGuard } from './guards/tenant-org.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { PermissionResolutionService } from './services/permission-resolution.service';

@Global()
@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    forwardRef(() => OrganizationsModule),
  ],
  providers: [TenantOrgGuard, PermissionsGuard, PermissionResolutionService],
  exports: [TenantOrgGuard, PermissionsGuard, PermissionResolutionService],
})
export class AuthorizationModule {}