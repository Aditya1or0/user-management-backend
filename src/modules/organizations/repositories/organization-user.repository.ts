import { Injectable } from '@nestjs/common';
import { MemberRole, Organization, OrganizationUser, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

export type MemberRoleWithRole = MemberRole & { role: Role };

export type OrganizationUserWithRelations = OrganizationUser & {
  organization: Organization;
  roles?: MemberRoleWithRole[];
};

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
  ): Promise<OrganizationUserWithRelations | null> {
    return this.getClient(tx).organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
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

  async findUserOrganizations(
    userId: string,
    tx?: PrismaClientOrTx,
  ): Promise<OrganizationUserWithRelations[]> {
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
