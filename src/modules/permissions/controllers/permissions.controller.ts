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
  Query,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from '../services/permissions.service';
import { PermissionQueryDto } from '../dto/permission-query.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionResponseDto } from '../dto/permission-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantOrgGuard } from '../../authorization/guards/tenant-org.guard';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard, TenantOrgGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('permissions:read')
  async getPermissions(
    @Query() query: PermissionQueryDto,
  ): Promise<PaginatedResponseDto<PermissionResponseDto>> {
    return this.permissionsService.getPermissions(query);
  }

  @Get('meta')
  @RequirePermissions('permissions:read')
  async getPermissionMeta(): Promise<{ modules: string[]; actions: string[] }> {
    return this.permissionsService.getPermissionMeta();
  }

  @Get(':id')
  @RequirePermissions('permissions:read')
  async getPermissionById(@Param('id') id: string): Promise<PermissionResponseDto> {
    return this.permissionsService.getPermissionById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('permissions:create')
  async createPermission(
    @Body() dto: CreatePermissionDto,
  ): Promise<PermissionResponseDto> {
    return this.permissionsService.createPermission(dto);
  }

  @Patch(':id')
  @RequirePermissions('permissions:update')
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ): Promise<PermissionResponseDto> {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('permissions:delete')
  async deletePermission(@Param('id') id: string): Promise<{ message: string }> {
    return this.permissionsService.deletePermission(id);
  }
}
