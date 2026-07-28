import { Module } from '@nestjs/common';
import { UserPermissionsController } from './controllers/user-permissions.controller';
import { UserPermissionOverrideService } from './services/user-permission-override.service';
import { UserPermissionOverrideRepository } from './repositories/user-permission-override.repository';
import { DatabaseModule } from '../../database/database.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  controllers: [UserPermissionsController],
  providers: [UserPermissionOverrideService, UserPermissionOverrideRepository],
  exports: [UserPermissionOverrideService],
})
export class UserPermissionsModule {}
