import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleRepository } from '../repositories/role.repository';
import { PermissionRepository } from '../../permissions/repositories/permission.repository';
import { RoleQueryDto } from '../dto/role-query.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleResponseDto } from '../dto/role-response.dto';
import { RoleMatrixResponseDto } from '../dto/role-matrix-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { CacheService } from '../../../cache/cache.service';
import { permissionCacheKeys } from '../../authorization/constants/permission-cache.keys';

@Injectable()
export class RolesService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getRoles(
    organizationId: string,
    query: RoleQueryDto,
  ): Promise<PaginatedResponseDto<RoleResponseDto>> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [items, total] = await this.roleRepository.findManyPaginated(
      organizationId,
      query,
    );

    const dtos = items.map((item) => new RoleResponseDto(item));
    return new PaginatedResponseDto<RoleResponseDto>(dtos, total, page, limit);
  }

  async getPermissionMatrix(): Promise<RoleMatrixResponseDto> {
    const matrixData = await this.roleRepository.getPermissionMatrix();
    return new RoleMatrixResponseDto(matrixData);
  }

  async getRoleById(id: string, organizationId: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findById(id, organizationId);
    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' was not found in this organization.`);
    }

    return new RoleResponseDto(role);
  }

  private async validatePermissionIds(permissionIds: string[]): Promise<void> {
    if (!permissionIds || permissionIds.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(permissionIds));
    const findPromises = uniqueIds.map((id) => this.permissionRepository.findById(id));
    const permissions = await Promise.all(findPromises);

    const invalidOrInactive = permissions.filter((p) => !p || !p.isActive);
    if (invalidOrInactive.length > 0) {
      throw new BadRequestException(
        'One or more permission IDs provided are invalid, missing, or inactive.',
      );
    }
  }

  async createRole(
    organizationId: string,
    dto: CreateRoleDto,
  ): Promise<RoleResponseDto> {
    const nameTrimmed = dto.name.trim();

    const existingName = await this.roleRepository.findByName(
      organizationId,
      nameTrimmed,
    );
    if (existingName) {
      throw new ConflictException(
        `Role with name '${nameTrimmed}' already exists in this organization.`,
      );
    }

    if (dto.key && dto.key.trim()) {
      const keyTrimmed = dto.key.toLowerCase().trim();
      const existingKey = await this.roleRepository.findByKey(
        organizationId,
        keyTrimmed,
      );
      if (existingKey) {
        throw new ConflictException(
          `Role key '${keyTrimmed}' already exists in this organization.`,
        );
      }
    }

    await this.validatePermissionIds(dto.permissionIds);

    const created = await this.roleRepository.createWithPermissions(
      organizationId,
      {
        name: nameTrimmed,
        key: dto.key ? dto.key.toLowerCase().trim() : undefined,
        description: dto.description?.trim(),
      },
      dto.permissionIds,
    );

    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());
    return new RoleResponseDto(created);
  }

  async updateRole(
    id: string,
    organizationId: string,
    dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const existing = await this.roleRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundException(`Role with ID '${id}' was not found in this organization.`);
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const nameConflict = await this.roleRepository.findByName(
        organizationId,
        dto.name.trim(),
      );
      if (nameConflict && nameConflict.id !== id) {
        throw new ConflictException(
          `Role name '${dto.name.trim()}' is already used in this organization.`,
        );
      }
    }

    if (existing.isSystem) {
      if (dto.name && dto.name.trim() !== existing.name) {
        throw new ForbiddenException('Protected system role names cannot be renamed.');
      }
      if (dto.key && dto.key.toLowerCase().trim() !== existing.key) {
        throw new ForbiddenException('Protected system role keys cannot be modified.');
      }
    }

    if (dto.permissionIds) {
      await this.validatePermissionIds(dto.permissionIds);
    }

    const updated = await this.roleRepository.updateWithPermissions(
      id,
      organizationId,
      {
        name: dto.name ? dto.name.trim() : undefined,
        key: dto.key ? dto.key.toLowerCase().trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
      },
      dto.permissionIds,
    );

    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());
    return new RoleResponseDto(updated);
  }

  async deleteRole(id: string, organizationId: string): Promise<{ message: string }> {
    const existing = await this.roleRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundException(`Role with ID '${id}' was not found in this organization.`);
    }

    if (existing.isSystem) {
      throw new ForbiddenException('Default system roles cannot be deleted.');
    }

    const assignedUsersCount = existing._count?.members || 0;
    if (assignedUsersCount > 0) {
      throw new ConflictException(
        `Cannot delete role '${existing.name}' because it is assigned to ${assignedUsersCount} active member(s). Reassign these members first.`,
      );
    }

    await this.roleRepository.deleteRole(id, organizationId);
    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());

    return { message: `Role '${existing.name}' was successfully deleted.` };
  }

  async getRoleBySlug(publicSlug: string, organizationId: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findBySlug(organizationId, publicSlug);
    if (!role) {
      throw new NotFoundException(`Role was not found in this organization.`);
    }

    return new RoleResponseDto(role);
  }

  async updateRoleBySlug(
    publicSlug: string,
    organizationId: string,
    dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const existing = await this.roleRepository.findBySlug(organizationId, publicSlug);
    if (!existing) {
      throw new NotFoundException(`Role was not found in this organization.`);
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const nameConflict = await this.roleRepository.findByName(
        organizationId,
        dto.name.trim(),
      );
      if (nameConflict && nameConflict.id !== existing.id) {
        throw new ConflictException(
          `Role name '${dto.name.trim()}' is already used in this organization.`,
        );
      }
    }

    if (existing.isSystem) {
      if (dto.name && dto.name.trim() !== existing.name) {
        throw new ForbiddenException('Protected system role names cannot be renamed.');
      }
      if (dto.key && dto.key.toLowerCase().trim() !== existing.key) {
        throw new ForbiddenException('Protected system role keys cannot be modified.');
      }
    }

    if (dto.permissionIds) {
      await this.validatePermissionIds(dto.permissionIds);
    }

    const updated = await this.roleRepository.updateWithPermissions(
      existing.id,
      organizationId,
      {
        name: dto.name ? dto.name.trim() : undefined,
        key: dto.key ? dto.key.toLowerCase().trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
      },
      dto.permissionIds,
    );

    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());
    return new RoleResponseDto(updated);
  }

  async deleteRoleBySlug(publicSlug: string, organizationId: string): Promise<{ message: string }> {
    const existing = await this.roleRepository.findBySlug(organizationId, publicSlug);
    if (!existing) {
      throw new NotFoundException(`Role was not found in this organization.`);
    }

    if (existing.isSystem) {
      throw new ForbiddenException('Default system roles cannot be deleted.');
    }

    const assignedUsersCount = existing._count?.members || 0;
    if (assignedUsersCount > 0) {
      throw new ConflictException(
        `Cannot delete role '${existing.name}' because it is assigned to ${assignedUsersCount} active member(s). Reassign these members first.`,
      );
    }

    await this.roleRepository.deleteRole(existing.id, organizationId);
    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());

    return { message: `Role '${existing.name}' was successfully deleted.` };
  }
}
