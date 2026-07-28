import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { MemberRole, Role } from '@prisma/client';
import { RoleRepository } from '../../roles/repositories/role.repository';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { SystemRole } from '../../../common/enums/system-role.enum';
import { SYSTEM_ROLE_DEFINITIONS } from '../../../common/constants/roles.constants';

@Injectable()
export class RoleProvisioningService {
  constructor(
    @Inject(forwardRef(() => RoleRepository))
    private readonly roleRepository: RoleRepository,
  ) {}

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
    const role = await this.roleRepository.create(
      {
        organization: { connect: { id: organizationId } },
        name: definition.name,
        publicSlug: definition.key + '-' + Math.random().toString(36).substring(2, 6),
        key: definition.key,
        description: definition.description,
        isSystem: true,
      },
      tx,
    );

    if (roleKey === SystemRole.OWNER) {
      await this.attachAllPermissionsToRole(role.id, tx);
    }

    return role;
  }

  private async attachAllPermissionsToRole(roleId: string, tx?: PrismaClientOrTx) {
    const client = tx || this.roleRepository['prisma'];
    const permissions = await client.permission.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (permissions.length > 0) {
      await client.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }
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
