import { Body, Controller, Get, NotFoundException, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantOrgGuard } from '../../authorization/guards/tenant-org.guard';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { UserPermissionOverrideService } from '../services/user-permission-override.service';
import { BulkUpdateUserPermissionsDto } from '../dto/bulk-update-user-permissions.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';
import { CurrentOrgId } from '../../../common/decorators/current-org.decorator';
import { PrismaService } from '../../../database/database.service';

@Controller('users/:publicSlug/permissions')
@UseGuards(JwtAuthGuard, TenantOrgGuard, PermissionsGuard)
export class UserPermissionsController {
  constructor(
    private readonly userPermissionOverrideService: UserPermissionOverrideService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('users:manage_permissions')
  async getUserPermissions(
    @Param('publicSlug') publicSlug: string,
    @CurrentOrgId() orgId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { publicSlug },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const overrides = await this.userPermissionOverrideService.getUserOverrides(user.id, orgId);
    
    return {
      overrides: {
        granted: overrides.filter(o => o.effect === 'GRANT').map(o => ({ permissionId: o.permissionId, key: o.permission.key })),
        denied: overrides.filter(o => o.effect === 'DENY').map(o => ({ permissionId: o.permissionId, key: o.permission.key })),
      }
    };
  }

  @Put()
  @RequirePermissions('users:manage_permissions')
  async bulkUpdateUserPermissions(
    @Param('publicSlug') publicSlug: string,
    @CurrentOrgId() orgId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BulkUpdateUserPermissionsDto,
    @Req() request: any,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { publicSlug },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userPermissionOverrideService.bulkUpdatePermissions(
      user.id,
      orgId,
      actor,
      dto,
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] }
    );
  }
}
