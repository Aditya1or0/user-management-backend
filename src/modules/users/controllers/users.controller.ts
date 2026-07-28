import { Controller, Get, NotFoundException, ForbiddenException, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantOrgGuard } from '../../authorization/guards/tenant-org.guard';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { CurrentOrgId } from '../../../common/decorators/current-org.decorator';
import { PrismaService } from '../../../database/database.service';
import { PermissionResolutionService } from '../../authorization/services/permission-resolution.service';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantOrgGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolutionService: PermissionResolutionService,
  ) {}

  @Get(':publicSlug')
  @RequirePermissions('users:read')
  async getUserDetail(
    @Param('publicSlug') publicSlug: string,
    @CurrentOrgId() orgId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { publicSlug },
      include: {
        memberships: {
          where: { organizationId: orgId },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    const effectivePermissions = await this.permissionResolutionService.resolveEffectivePermissions(user.id, orgId);
    
    // Structure the response explicitly stripping sensitive fields
    return {
      user: {
        id: user.id,
        publicSlug: user.publicSlug,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
      },
      membership: {
        status: membership.status,
        joinedAt: membership.joinedAt,
      },
      roles: membership.roles.map((mr) => ({
        id: mr.role.id,
        name: mr.role.name,
        publicSlug: mr.role.publicSlug,
        isSystem: mr.role.isSystem,
      })),
      permissionSummary: {
        rolePermissions: effectivePermissions.filter(p => p.source === 'ROLE' || p.source === 'OWNER').map(p => p.key),
        grantedOverrides: effectivePermissions.filter(p => p.source === 'USER_OVERRIDE' && p.effect === 'GRANT').map(p => p.key),
        deniedOverrides: effectivePermissions.filter(p => p.source === 'USER_OVERRIDE' && p.effect === 'DENY').map(p => p.key),
        effectivePermissions: effectivePermissions.filter(p => p.effect === 'GRANT').map(p => p.key),
      },
    };
  }
}
