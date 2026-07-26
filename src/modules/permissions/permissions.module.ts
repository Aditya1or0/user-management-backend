import { Module } from '@nestjs/common';
import { PermissionRepository } from './repositories/permission.repository';
import { PermissionsService } from './services/permissions.service';
import { PermissionsController } from './controllers/permissions.controller';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
  ],
  controllers: [PermissionsController],
  providers: [PermissionRepository, PermissionsService],
  exports: [PermissionRepository, PermissionsService],
})
export class PermissionsModule {}
