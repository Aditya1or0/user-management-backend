import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PrismaService } from '../../../database/database.service';
import { CacheService } from '../../../cache/cache.service';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const orgId = request.orgId as string | undefined;
    const organization = request.organization;

    if (!user || !user.id || !orgId) {
      throw new ForbiddenException('Organization context and authentication required.');
    }

    // 1. Owner Bypass
    if (organization && organization.ownerId === user.id) {
      return true;
    }

    // 2. Load user's permission keys in this organization (with Redis cache)
    const cacheKey = `auth:perms:${orgId}:${user.id}`;
    let userPermissions = await this.cacheService.get<string[]>(cacheKey);

    if (!userPermissions) {
      const memberRoles = await this.prisma.memberRole.findMany({
        where: {
          member: {
            organizationId: orgId,
            userId: user.id,
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

      const permissionKeysSet = new Set<string>();

      for (const mr of memberRoles) {
        // System owner role key check
        if (mr.role.key === 'owner' || mr.role.name === 'Super Admin') {
          permissionKeysSet.add('*');
        }
        for (const rp of mr.role.permissions) {
          if (rp.permission && rp.permission.isActive) {
            permissionKeysSet.add(rp.permission.key);
          }
        }
      }

      userPermissions = Array.from(permissionKeysSet);
      await this.cacheService.set(cacheKey, userPermissions, 300); // 5 minutes TTL
    }

    if (userPermissions.includes('*')) {
      return true;
    }

    const hasAllRequired = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllRequired) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
