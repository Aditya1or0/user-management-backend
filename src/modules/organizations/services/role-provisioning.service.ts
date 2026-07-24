import { Injectable } from '@nestjs/common';
import { MemberRole, Role } from '@prisma/client';
import { RoleRepository } from '../../roles/repositories/role.repository';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { SystemRole } from '../../../common/enums/system-role.enum';
import { SYSTEM_ROLE_DEFINITIONS } from '../../../common/constants/roles.constants';

@Injectable()
export class RoleProvisioningService {
  constructor(private readonly roleRepository: RoleRepository) {}

  /**
   * Ensures a specific system role exists for an organization.
   */
  async provisionSystemRole(
    organizationId: string,
    roleKey: SystemRole,
    tx?: PrismaClientOrTx,
  ): Promise<Role> {
    const existing = await this.roleRepository.findByKey(organizationId, roleKey, tx);
    if (existing) {
      return existing;
    }

    const definition = SYSTEM_ROLE_DEFINITIONS[roleKey];
    return this.roleRepository.create(
      {
        organization: { connect: { id: organizationId } },
        name: definition.name,
        key: definition.key,
        description: definition.description,
        isSystem: true,
      },
      tx,
    );
  }

  /**
   * Assigns a role to an OrganizationUser member.
   */
  async assignRoleToMember(
    memberId: string,
    roleId: string,
    tx?: PrismaClientOrTx,
  ): Promise<MemberRole> {
    return this.roleRepository.assignRoleToMember(memberId, roleId, tx);
  }
}
