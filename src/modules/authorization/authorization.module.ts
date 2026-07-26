import { Global, Module, forwardRef } from '@nestjs/common';
import { TenantOrgGuard } from './guards/tenant-org.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    forwardRef(() => OrganizationsModule),
  ],
  providers: [TenantOrgGuard, PermissionsGuard],
  exports: [TenantOrgGuard, PermissionsGuard],
})
export class AuthorizationModule {}