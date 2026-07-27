import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from '../services/roles.service';
import { RoleQueryDto } from '../dto/role-query.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleResponseDto } from '../dto/role-response.dto';
import { RoleMatrixResponseDto } from '../dto/role-matrix-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantOrgGuard } from '../../authorization/guards/tenant-org.guard';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { CurrentOrgId } from '../../../common/decorators/current-org.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, TenantOrgGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles:read')
  async getRoles(
    @CurrentOrgId() orgId: string,
    @Query() query: RoleQueryDto,
  ): Promise<PaginatedResponseDto<RoleResponseDto>> {
    return this.rolesService.getRoles(orgId, query);
  }

  @Get('matrix')
  @RequirePermissions('roles:read')
  async getPermissionMatrix(): Promise<RoleMatrixResponseDto> {
    return this.rolesService.getPermissionMatrix();
  }

  @Get(':slug')
  @RequirePermissions('roles:read')
  async getRoleBySlug(
    @CurrentOrgId() orgId: string,
    @Param('slug') slug: string,
  ): Promise<RoleResponseDto> {
    return this.rolesService.getRoleBySlug(slug, orgId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('roles:create')
  async createRole(
    @CurrentOrgId() orgId: string,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.createRole(orgId, dto);
  }

  @Patch(':slug')
  @RequirePermissions('roles:update')
  async updateRole(
    @CurrentOrgId() orgId: string,
    @Param('slug') slug: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.updateRoleBySlug(slug, orgId, dto);
  }

  @Put(':slug')
  @RequirePermissions('roles:update')
  async replaceRole(
    @CurrentOrgId() orgId: string,
    @Param('slug') slug: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.updateRoleBySlug(slug, orgId, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('roles:delete')
  async deleteRole(
    @CurrentOrgId() orgId: string,
    @Param('slug') slug: string,
  ): Promise<{ message: string }> {
    return this.rolesService.deleteRoleBySlug(slug, orgId);
  }
}
