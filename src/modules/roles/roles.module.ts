import { Module } from '@nestjs/common';
import { RoleRepository } from './repositories/role.repository';
import { RolesService } from './services/roles.service';
import { RolesController } from './controllers/roles.controller';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    PermissionsModule,
  ],
  controllers: [RolesController],
  providers: [RoleRepository, RolesService],
  exports: [RoleRepository, RolesService],
})
export class RolesModule {}
