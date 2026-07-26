import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { MemberQueryDto } from '../dto/member-query.dto';

const ALLOWED_MEMBER_SORT_FIELDS = ['createdAt', 'joinedAt', 'email', 'status'];

const MEMBER_INCLUDE = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      isActive: true,
      lastLoginAt: true,
    },
  },
  roles: {
    include: {
      role: {
        select: {
          id: true,
          name: true,
          key: true,
          isSystem: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class MemberRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findManyPaginated(
    organizationId: string,
    query: MemberQueryDto,
    tx?: PrismaClientOrTx,
  ): Promise<[any[], number]> {
    const client = this.getClient(tx);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationUserWhereInput = { organizationId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const sortField = ALLOWED_MEMBER_SORT_FIELDS.includes(query.sortBy || '')
      ? (query.sortBy as string)
      : 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const orderBy: Prisma.OrganizationUserOrderByWithRelationInput =
      sortField === 'email'
        ? { email: sortOrder }
        : sortField === 'status'
          ? { status: sortOrder }
          : sortField === 'joinedAt'
            ? { joinedAt: sortOrder }
            : { createdAt: sortOrder };

    const [items, total] = await Promise.all([
      client.organizationUser.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: MEMBER_INCLUDE,
      }),
      client.organizationUser.count({ where }),
    ]);

    return [items, total];
  }

  async findById(
    memberId: string,
    organizationId: string,
    tx?: PrismaClientOrTx,
  ): Promise<any | null> {
    return this.getClient(tx).organizationUser.findFirst({
      where: { id: memberId, organizationId },
      include: MEMBER_INCLUDE,
    });
  }

  async findByUserId(
    userId: string,
    organizationId: string,
    tx?: PrismaClientOrTx,
  ): Promise<any | null> {
    return this.getClient(tx).organizationUser.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: MEMBER_INCLUDE,
    });
  }

  async updateStatus(
    memberId: string,
    status: UserStatus,
    tx?: PrismaClientOrTx,
  ): Promise<any> {
    const client = this.getClient(tx);
    await client.organizationUser.update({
      where: { id: memberId },
      data: { status },
    });
  }

  /**
   * Atomically replaces all roles for a member.
   */
  async syncRoles(
    memberId: string,
    roleIds: string[],
    tx?: PrismaClientOrTx,
  ): Promise<void> {
    const execute = async (prismaTx: PrismaClientOrTx) => {
      await prismaTx.memberRole.deleteMany({ where: { memberId } });
      if (roleIds.length > 0) {
        await prismaTx.memberRole.createMany({
          data: roleIds.map((roleId) => ({ memberId, roleId })),
        });
      }
    };

    if (tx) {
      return execute(tx);
    }
    return this.defaultPrisma.$transaction((prismaTx) => execute(prismaTx));
  }

  async remove(
    memberId: string,
    organizationId: string,
    tx?: PrismaClientOrTx,
  ): Promise<void> {
    await this.getClient(tx).organizationUser.delete({
      where: { id: memberId },
    });
  }
}
