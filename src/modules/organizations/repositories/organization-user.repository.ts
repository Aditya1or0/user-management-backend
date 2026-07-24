import { Injectable } from '@nestjs/common';
import { OrganizationUser, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

@Injectable()
export class OrganizationUserRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string,
    tx?: PrismaClientOrTx,
  ): Promise<OrganizationUser | null> {
    return this.getClient(tx).organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
  }

  async findUserOrganizations(
    userId: string,
    tx?: PrismaClientOrTx,
  ): Promise<OrganizationUser[]> {
    return this.getClient(tx).organizationUser.findMany({
      where: { userId },
      include: {
        organization: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async create(
    data: Prisma.OrganizationUserCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<OrganizationUser> {
    return this.getClient(tx).organizationUser.create({ data });
  }
}
