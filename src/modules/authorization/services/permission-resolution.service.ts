import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { CacheService } from '../../../cache/cache.service';
import { permissionCacheKeys } from '../constants/permission-cache.keys';
import { UserPermissionEffect } from '@prisma/client';

export interface EffectivePermission {
  permissionId: string;
  key: string;
  source: 'OWNER' | 'ROLE' | 'USER_OVERRIDE';
  effect: 'GRANT' | 'DENY';
  roleIds?: string[];
}

@Injectable()
export class PermissionResolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Resolves the full structured effective permission matrix for a user.
   * This is used by the User Details API and internally to build the cache.
   */
  async resolveEffectivePermissions(userId: string, organizationId: string): Promise<EffectivePermission[]> {
    // 1. Check if user is organization owner
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });

    if (organization && organization.ownerId === userId) {
      const allActivePermissions = await this.prisma.permission.findMany({
        where: { isActive: true },
        select: { id: true, key: true },
      });

      return [
        {
          permissionId: 'owner-wildcard',
          key: '*',
          source: 'OWNER',
          effect: 'GRANT',
        },
        ...allActivePermissions.map((p) => ({
          permissionId: p.id,
          key: p.key,
          source: 'OWNER' as const,
          effect: 'GRANT' as const,
        })),
      ];
    }

    const effectivePermissionsMap = new Map<string, EffectivePermission>();

    // 2. Fetch Role Permissions
    const rolePermissions = await this.resolveRolePermissions(userId, organizationId);
    for (const rp of rolePermissions) {
      if (!effectivePermissionsMap.has(rp.key)) {
        effectivePermissionsMap.set(rp.key, {
          permissionId: rp.permissionId,
          key: rp.key,
          source: 'ROLE',
          effect: 'GRANT',
          roleIds: [rp.roleId],
        });
      } else {
        const existing = effectivePermissionsMap.get(rp.key)!;
        if (existing.roleIds) {
          existing.roleIds.push(rp.roleId);
        }
      }
    }

    // 3. Fetch User Overrides
    const userOverrides = await this.resolveUserOverrides(userId, organizationId);
    
    // 4. Apply Overrides (DENY takes precedence over GRANT)
    for (const override of userOverrides) {
      if (override.effect === 'DENY') {
        effectivePermissionsMap.set(override.key, {
          permissionId: override.permissionId,
          key: override.key,
          source: 'USER_OVERRIDE',
          effect: 'DENY',
        });
      } else if (override.effect === 'GRANT') {
        // Only apply GRANT if not already DENIED by another override
        // (Though db schema shouldn't allow duplicate permissionId, we check anyway)
        if (!effectivePermissionsMap.has(override.key) || effectivePermissionsMap.get(override.key)!.effect !== 'DENY') {
          effectivePermissionsMap.set(override.key, {
            permissionId: override.permissionId,
            key: override.key,
            source: 'USER_OVERRIDE',
            effect: 'GRANT',
          });
        }
      }
    }

    return Array.from(effectivePermissionsMap.values());
  }

  /**
   * Helper to get Role Permissions
   */
  async resolveRolePermissions(userId: string, organizationId: string) {
    const memberRoles = await this.prisma.memberRole.findMany({
      where: {
        member: {
          organizationId,
          userId,
          status: 'ACTIVE',
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const result: { permissionId: string; key: string; roleId: string }[] = [];
    for (const mr of memberRoles) {
      // Owner system role wildcard
      if (mr.role.isSystem && mr.role.key === 'owner') {
        result.push({ permissionId: 'role-wildcard', key: '*', roleId: mr.role.id });
      }
      for (const rp of mr.role.permissions) {
        if (rp.permission && rp.permission.isActive) {
          result.push({
            permissionId: rp.permission.id,
            key: rp.permission.key,
            roleId: mr.role.id,
          });
        }
      }
    }
    return result;
  }

  /**
   * Helper to get explicit user overrides
   */
  async resolveUserOverrides(userId: string, organizationId: string) {
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: {
        userId,
        organizationId,
      },
      include: {
        permission: true,
      },
    });

    return overrides.map(o => ({
      permissionId: o.permissionId,
      key: o.permission.key,
      effect: o.effect,
    }));
  }

  /**
   * Resolves the list of granted permission keys (strings) for guards.
   * Leverages Redis caching for performance.
   */
  async getGrantedPermissionKeys(userId: string, organizationId: string): Promise<string[]> {
    const cacheKey = permissionCacheKeys.userPermissions(userId, organizationId);
    const cached = await this.cacheService.get<string[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const effectivePermissions = await this.resolveEffectivePermissions(userId, organizationId);
    
    // Filter to only GRANTED permissions
    const grantedKeys = effectivePermissions
      .filter(p => p.effect === 'GRANT')
      .map(p => p.key);

    await this.cacheService.set(cacheKey, grantedKeys, 300); // 5 minutes TTL
    return grantedKeys;
  }

  /**
   * Checks if a user has a specific permission.
   */
  async hasPermission(userId: string, organizationId: string, permissionKey: string): Promise<boolean> {
    const grantedKeys = await this.getGrantedPermissionKeys(userId, organizationId);
    return grantedKeys.includes('*') || grantedKeys.includes(permissionKey);
  }

  /**
   * Invalidates the user's permission cache.
   */
  async invalidateUserCache(userId: string, organizationId: string): Promise<void> {
    const cacheKey = permissionCacheKeys.userPermissions(userId, organizationId);
    await this.cacheService.delete(cacheKey);
  }
}
