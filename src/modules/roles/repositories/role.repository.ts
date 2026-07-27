import { Injectable } from '@nestjs/common';
import { MemberRole, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { RoleQueryDto } from '../dto/role-query.dto';
import { PermissionMatrixModuleDto } from '../dto/role-matrix-response.dto';
import { generatePublicSlug } from '../../../common/utils/slug.util';

const ALLOWED_ROLE_SORT_FIELDS = ['name', 'key', 'createdAt', 'isSystem'];

@Injectable()
export class RoleRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findByKey(
    organizationId: string,
    key: string,
    tx?: PrismaClientOrTx,
  ): Promise<Role | null> {
    return this.getClient(tx).role.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
    });
  }

  async findByName(
    organizationId: string,
    name: string,
    tx?: PrismaClientOrTx,
  ): Promise<Role | null> {
    return this.getClient(tx).role.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
    });
  }

  async findBySlug(
    organizationId: string,
    publicSlug: string,
    tx?: PrismaClientOrTx,
  ): Promise<any | null> {
    return this.getClient(tx).role.findUnique({
      where: {
        publicSlug,
        organizationId,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            members: true,
            permissions: true,
          },
        },
      },
    });
  }

  async findById(
    id: string,
    organizationId?: string,
    tx?: PrismaClientOrTx,
  ): Promise<any | null> {
    const where: Prisma.RoleWhereInput = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.getClient(tx).role.findFirst({
      where,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            members: true,
            permissions: true,
          },
        },
      },
    });
  }

  async findManyPaginated(
    organizationId: string,
    query: RoleQueryDto,
    tx?: PrismaClientOrTx,
  ): Promise<[any[], number]> {
    const client = this.getClient(tx);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = { organizationId };

    if (query.search && query.search.trim()) {
      const searchStr = query.search.trim();
      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { key: { contains: searchStr, mode: 'insensitive' } },
        { description: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const sortField = ALLOWED_ROLE_SORT_FIELDS.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const sortOrder = query.sortOrder || 'asc';

    const orderBy: Prisma.RoleOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [items, total] = await Promise.all([
      client.role.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              members: true,
              permissions: true,
            },
          },
        },
      }),
      client.role.count({ where }),
    ]);

    return [items, total];
  }

  async getPermissionMatrix(tx?: PrismaClientOrTx): Promise<PermissionMatrixModuleDto[]> {
    const client = this.getClient(tx);

    const activePermissions = await client.permission.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });

    const moduleMap = new Map<string, any[]>();

    for (const perm of activePermissions) {
      // Capitalize module name for display e.g. "users" -> "Users"
      const moduleName = perm.module.charAt(0).toUpperCase() + perm.module.slice(1);
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, []);
      }

      moduleMap.get(moduleName)!.push({
        id: perm.id,
        key: perm.key,
        action: perm.action,
        description: perm.description,
      });
    }

    const matrix: PermissionMatrixModuleDto[] = [];
    moduleMap.forEach((permissions, module) => {
      matrix.push({ module, permissions });
    });

    return matrix;
  }

  async create(
    data: Prisma.RoleCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<Role> {
    const publicSlug = data.publicSlug || generatePublicSlug(data.name);
    return this.getClient(tx).role.create({ 
      data: {
        ...data,
        publicSlug
      }
    });
  }

  async createWithPermissions(
    organizationId: string,
    data: { name: string; key?: string; description?: string },
    permissionIds: string[],
    tx?: PrismaClientOrTx,
  ): Promise<any> {
    const client = this.getClient(tx);

    const execute = async (prismaTx: PrismaClientOrTx) => {
      const createdRole = await prismaTx.role.create({
        data: {
          organization: { connect: { id: organizationId } },
          name: data.name,
          publicSlug: generatePublicSlug(data.name),
          key: data.key || null,
          description: data.description || null,
          isSystem: false,
        },
      });

      if (permissionIds && permissionIds.length > 0) {
        await prismaTx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: createdRole.id,
            permissionId,
          })),
        });
      }

      return this.findById(createdRole.id, organizationId, prismaTx);
    };

    if (tx) {
      return execute(tx);
    }

    return this.defaultPrisma.$transaction(async (prismaTx) => execute(prismaTx));
  }

  async updateWithPermissions(
    id: string,
    organizationId: string,
    data: { name?: string; key?: string; description?: string },
    permissionIds?: string[],
    tx?: PrismaClientOrTx,
  ): Promise<any> {
    const execute = async (prismaTx: PrismaClientOrTx) => {
      const updateData: Prisma.RoleUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.key !== undefined) updateData.key = data.key;
      if (data.description !== undefined) updateData.description = data.description;

      await prismaTx.role.update({
        where: { id },
        data: updateData,
      });

      if (permissionIds !== undefined) {
        await prismaTx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        if (permissionIds.length > 0) {
          await prismaTx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      return this.findById(id, organizationId, prismaTx);
    };

    if (tx) {
      return execute(tx);
    }

    return this.defaultPrisma.$transaction(async (prismaTx) => execute(prismaTx));
  }

  async assignRoleToMember(
    memberId: string,
    roleId: string,
    tx?: PrismaClientOrTx,
  ): Promise<MemberRole> {
    return this.getClient(tx).memberRole.create({
      data: {
        memberId,
        roleId,
      },
    });
  }

  async deleteRole(id: string, organizationId: string, tx?: PrismaClientOrTx): Promise<void> {
    const client = this.getClient(tx);
    await client.role.delete({
      where: { id },
    });
  }
}
