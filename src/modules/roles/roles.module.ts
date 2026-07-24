import { Module } from '@nestjs/common';
import { RoleRepository } from './repositories/role.repository';

@Module({
  providers: [RoleRepository],
  exports: [RoleRepository],
})
export class RolesModule {}
