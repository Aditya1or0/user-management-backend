import { Injectable } from '@nestjs/common';
import { MemberRole, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

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

  async create(
    data: Prisma.RoleCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<Role> {
    return this.getClient(tx).role.create({ data });
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
}
