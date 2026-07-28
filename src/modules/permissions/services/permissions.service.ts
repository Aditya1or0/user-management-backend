import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import { PermissionQueryDto } from '../dto/permission-query.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionResponseDto } from '../dto/permission-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { CacheService } from '../../../cache/cache.service';
import { permissionCacheKeys } from '../../authorization/constants/permission-cache.keys';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
    private readonly cacheService: CacheService,
  ) {}

  private normalizeKey(module: string, action: string, providedKey?: string): string {
    if (providedKey && providedKey.trim()) {
      return providedKey.toLowerCase().trim();
    }
    return `${module.toLowerCase().trim()}:${action.toLowerCase().trim()}`;
  }

  async getPermissions(
    query: PermissionQueryDto,
  ): Promise<PaginatedResponseDto<PermissionResponseDto>> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [items, total] = await this.permissionRepository.findManyPaginated(query);
    const dtos = items.map((item) => new PermissionResponseDto(item));

    return new PaginatedResponseDto<PermissionResponseDto>(dtos, total, page, limit);
  }

  async getPermissionMeta(): Promise<{ modules: string[]; actions: string[] }> {
    const cacheKey = permissionCacheKeys.permissionMeta();
    const cached = await this.cacheService.get<{ modules: string[]; actions: string[] }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const meta = await this.permissionRepository.getAvailableModulesAndActions();
    await this.cacheService.set(cacheKey, meta, 3600);
    return meta;
  }

  async getPermissionById(id: string): Promise<PermissionResponseDto> {
    const permission = await this.permissionRepository.findById(id);
    if (!permission) {
      throw new NotFoundException(`Permission with ID '${id}' was not found.`);
    }
    return new PermissionResponseDto(permission);
  }

  async createPermission(dto: CreatePermissionDto): Promise<PermissionResponseDto> {
    const key = this.normalizeKey(dto.module, dto.action, dto.key);

    const existing = await this.permissionRepository.findByKey(key);
    if (existing) {
      throw new ConflictException(`Permission key '${key}' already exists.`);
    }

    const created = await this.permissionRepository.create({
      module: dto.module.trim(),
      action: dto.action.trim(),
      key,
      description: dto.description?.trim() || null,
      isActive: true,
    });

    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());
    await this.cacheService.delete(permissionCacheKeys.permissionMeta());
    return new PermissionResponseDto(created);
  }

  async updatePermission(
    id: string,
    dto: UpdatePermissionDto,
  ): Promise<PermissionResponseDto> {
    const existing = await this.permissionRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Permission with ID '${id}' was not found.`);
    }

    const targetModule = dto.module?.trim() || existing.module;
    const targetAction = dto.action?.trim() || existing.action;
    let newKey = existing.key;

    if (dto.key || dto.module || dto.action) {
      newKey = this.normalizeKey(targetModule, targetAction, dto.key);
      if (newKey !== existing.key) {
        const keyConflict = await this.permissionRepository.findByKey(newKey);
        if (keyConflict && keyConflict.id !== id) {
          throw new ConflictException(`Permission key '${newKey}' is already taken.`);
        }
      }
    }

    const updated = await this.permissionRepository.update(id, {
      module: targetModule,
      action: targetAction,
      key: newKey,
      description: dto.description !== undefined ? dto.description.trim() : existing.description,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
    });

    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());
    await this.cacheService.delete(permissionCacheKeys.permissionMeta());
    return new PermissionResponseDto(updated);
  }

  async deletePermission(id: string): Promise<{ message: string }> {
    const existing = await this.permissionRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Permission with ID '${id}' was not found.`);
    }

    const usedInRolesCount = existing._count?.roles || 0;
    if (usedInRolesCount > 0) {
      throw new ConflictException(
        `Cannot delete permission '${existing.key}' because it is assigned to ${usedInRolesCount} active role(s). Please remove it from all roles before deleting.`,
      );
    }

    await this.permissionRepository.delete(id);
    await this.cacheService.deleteByPattern(permissionCacheKeys.userPermissionsPattern());
    await this.cacheService.delete(permissionCacheKeys.permissionMeta());

    return { message: `Permission '${existing.key}' successfully deleted.` };
  }
}
