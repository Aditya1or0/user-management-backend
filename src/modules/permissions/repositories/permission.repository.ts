import { Injectable } from '@nestjs/common';
import { Permission, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { PermissionQueryDto } from '../dto/permission-query.dto';

const ALLOWED_SORT_FIELDS = ['key', 'module', 'action', 'isActive'];

@Injectable()
export class PermissionRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findManyPaginated(
    query: PermissionQueryDto,
    tx?: PrismaClientOrTx,
  ): Promise<[any[], number]> {
    const client = this.getClient(tx);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.PermissionWhereInput = {};

    if (query.module && query.module.toUpperCase() !== 'ALL MODULES' && query.module.toUpperCase() !== 'ALL') {
      where.module = { equals: query.module, mode: 'insensitive' };
    }

    if (query.action && query.action.toUpperCase() !== 'ALL ACTIONS' && query.action.toUpperCase() !== 'ALL') {
      where.action = { equals: query.action, mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const searchStr = query.search.trim();
      where.OR = [
        { key: { contains: searchStr, mode: 'insensitive' } },
        { module: { contains: searchStr, mode: 'insensitive' } },
        { action: { contains: searchStr, mode: 'insensitive' } },
        { description: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const sortField = ALLOWED_SORT_FIELDS.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'key';
    const sortOrder = query.sortOrder || 'asc';

    const orderBy: Prisma.PermissionOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [items, total] = await Promise.all([
      client.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { roles: true },
          },
        },
      }),
      client.permission.count({ where }),
    ]);

    return [items, total];
  }

  async findById(id: string, tx?: PrismaClientOrTx): Promise<any | null> {
    return this.getClient(tx).permission.findUnique({
      where: { id },
      include: {
        _count: {
          select: { roles: true },
        },
      },
    });
  }

  async findByKey(key: string, tx?: PrismaClientOrTx): Promise<Permission | null> {
    return this.getClient(tx).permission.findUnique({
      where: { key },
    });
  }

  async create(
    data: Prisma.PermissionCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<Permission> {
    return this.getClient(tx).permission.create({ data });
  }

  async update(
    id: string,
    data: Prisma.PermissionUpdateInput,
    tx?: PrismaClientOrTx,
  ): Promise<Permission> {
    return this.getClient(tx).permission.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: PrismaClientOrTx): Promise<Permission> {
    return this.getClient(tx).permission.delete({
      where: { id },
    });
  }

  async getAvailableModulesAndActions(tx?: PrismaClientOrTx): Promise<{
    modules: string[];
    actions: string[];
  }> {
    const client = this.getClient(tx);
    const [modulesResult, actionsResult] = await Promise.all([
      client.permission.findMany({
        select: { module: true },
        distinct: ['module'],
        where: { isActive: true },
      }),
      client.permission.findMany({
        select: { action: true },
        distinct: ['action'],
        where: { isActive: true },
      }),
    ]);

    return {
      modules: modulesResult.map((m) => m.module).sort(),
      actions: actionsResult.map((a) => a.action).sort(),
    };
  }
}
