import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserPermissionOverrideRepository } from '../repositories/user-permission-override.repository';
import { PrismaService } from '../../../database/database.service';
import { PermissionResolutionService } from '../../authorization/services/permission-resolution.service';
import { AuditService } from '../../audit/audit.service';
import { BulkUpdateUserPermissionsDto } from '../dto/bulk-update-user-permissions.dto';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';
import { UserPermissionEffect } from '@prisma/client';

@Injectable()
export class UserPermissionOverrideService {
  constructor(
    private readonly repository: UserPermissionOverrideRepository,
    private readonly prisma: PrismaService,
    private readonly permissionResolutionService: PermissionResolutionService,
    private readonly auditService: AuditService,
  ) {}

  async bulkUpdatePermissions(
    targetUserId: string,
    organizationId: string,
    actor: AuthenticatedUser,
    dto: BulkUpdateUserPermissionsDto,
    reqData: { ipAddress?: string; userAgent?: string }
  ) {
    // 1. Verify actor privileges
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    
    if (!org) {
      throw new ForbiddenException('Organization not found.');
    }

    const isOwner = org.ownerId === actor.id;
    let actorPermissions: string[] = [];

    if (!isOwner) {
      // Non-owners can only delegate permissions they possess
      actorPermissions = await this.permissionResolutionService.getGrantedPermissionKeys(actor.id, organizationId);
    }

    // Fetch permission objects for validation
    const permissionIds = dto.permissions.map(p => p.permissionId);
    const requestedPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    const validPermissionIds = new Set(requestedPermissions.map(p => p.id));
    const requestedPermissionsMap = new Map(requestedPermissions.map(p => [p.id, p]));

    for (const item of dto.permissions) {
      if (!validPermissionIds.has(item.permissionId)) {
        throw new ForbiddenException(`Invalid permission ID: ${item.permissionId}`);
      }

      if (!isOwner) {
        const permKey = requestedPermissionsMap.get(item.permissionId)!.key;
        if (!actorPermissions.includes(permKey) && !actorPermissions.includes('*')) {
          throw new ForbiddenException(`You do not have the right to delegate the permission: ${permKey}`);
        }
      }
    }

    // 2. Fetch current overrides for audit logging and to determine what to delete
    const currentOverrides = await this.repository.findUserOverrides(targetUserId, organizationId);
    const currentMap = new Map(currentOverrides.map(o => [o.permissionId, o.effect]));
    
    const newMap = new Map(dto.permissions.map(p => [p.permissionId, p.effect]));
    
    const toDeleteIds = currentOverrides
      .filter(o => !newMap.has(o.permissionId))
      .map(o => o.permissionId);

    // 3. Execute Transaction
    await this.prisma.$transaction(async (tx) => {
      if (toDeleteIds.length > 0) {
        await this.repository.bulkDeleteOverrides(targetUserId, organizationId, toDeleteIds, tx);
      }
      if (dto.permissions.length > 0) {
        await this.repository.bulkUpsertOverrides(targetUserId, organizationId, dto.permissions, tx);
      }
    });

    // 4. Invalidate Cache
    await this.permissionResolutionService.invalidateUserCache(targetUserId, organizationId);

    // 5. Audit Logging
    for (const item of dto.permissions) {
      const prevEffect = currentMap.get(item.permissionId);
      if (prevEffect !== item.effect) {
        const action = item.effect === 'GRANT' ? 'USER_PERMISSION_OVERRIDE_GRANTED' : 'USER_PERMISSION_OVERRIDE_DENIED';
        await this.auditService.record({
          organizationId,
          userId: actor.id,
          action,
          entity: 'User',
          entityId: targetUserId,
          ...(prevEffect ? { oldValue: { effect: prevEffect } } : {}),
          newValue: { effect: item.effect, permissionId: item.permissionId },
          ipAddress: reqData.ipAddress,
          userAgent: reqData.userAgent,
        });
      }
    }

    for (const delId of toDeleteIds) {
      await this.auditService.record({
        organizationId,
        userId: actor.id,
        action: 'USER_PERMISSION_OVERRIDE_REMOVED',
        entity: 'User',
        entityId: targetUserId,
        oldValue: { effect: currentMap.get(delId) },
        ipAddress: reqData.ipAddress,
        userAgent: reqData.userAgent,
      });
    }

    return { message: 'Permissions updated successfully.' };
  }

  async getUserOverrides(userId: string, organizationId: string) {
    return this.repository.findUserOverrides(userId, organizationId);
  }
}
