import { UserStatus } from '@prisma/client';

export class MemberRoleDto {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
}

export class MemberResponseDto {
  /** OrganizationUser.id — the membership record ID */
  id: string;

  /** Global User.id */
  userId: string;

  email: string;
  firstName: string;
  lastName: string;

  /** Computed: firstName + ' ' + lastName */
  name: string;

  avatarUrl: string | null;

  status: UserStatus;

  roles: MemberRoleDto[];
  roleIds: string[];

  /** No per-user permission override table yet — always empty */
  permissionOverrides: never[];

  joinedAt: Date | null;
  lastLoginAt: Date | null;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  static from(
    orgUser: any,
  ): MemberResponseDto {
    const user = orgUser.user;
    const memberRoles: MemberRoleDto[] = (orgUser.roles || []).map((mr: any) => ({
      id: mr.role.id,
      name: mr.role.name,
      key: mr.role.key,
      isSystem: mr.role.isSystem,
    }));

    return {
      id: orgUser.id,
      userId: user.id,
      email: orgUser.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      avatarUrl: user.avatarUrl ?? null,
      status: orgUser.status,
      roles: memberRoles,
      roleIds: memberRoles.map((r) => r.id),
      permissionOverrides: [],
      joinedAt: orgUser.joinedAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      isActive: user.isActive,
      createdAt: orgUser.createdAt,
      updatedAt: orgUser.updatedAt,
    };
  }
}
