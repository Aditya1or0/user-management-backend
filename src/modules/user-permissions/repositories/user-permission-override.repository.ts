import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { PrismaClient, UserPermissionEffect } from '@prisma/client';

export type PrismaClientOrTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class UserPermissionOverrideRepository {
  constructor(private readonly prisma: PrismaService) {}

  async bulkUpsertOverrides(
    userId: string,
    organizationId: string,
    overrides: { permissionId: string; effect: UserPermissionEffect }[],
    tx?: PrismaClientOrTx,
  ) {
    const prisma = tx || this.prisma;
    
    // We do individual upserts within the transaction since Prisma doesn't natively support bulk upsert with composite keys easily in a single query across all SQL dialects without raw queries.
    // However, we can use raw queries or standard queries inside a transaction.
    
    // For safety and compatibility:
    for (const override of overrides) {
      await prisma.userPermissionOverride.upsert({
        where: {
          userId_organizationId_permissionId: {
            userId,
            organizationId,
            permissionId: override.permissionId,
          },
        },
        update: {
          effect: override.effect,
        },
        create: {
          userId,
          organizationId,
          permissionId: override.permissionId,
          effect: override.effect,
        },
      });
    }
  }

  async bulkDeleteOverrides(
    userId: string,
    organizationId: string,
    permissionIds: string[],
    tx?: PrismaClientOrTx,
  ) {
    const prisma = tx || this.prisma;
    await prisma.userPermissionOverride.deleteMany({
      where: {
        userId,
        organizationId,
        permissionId: {
          in: permissionIds,
        },
      },
    });
  }

  async findUserOverrides(userId: string, organizationId: string) {
    return this.prisma.userPermissionOverride.findMany({
      where: {
        userId,
        organizationId,
      },
      include: {
        permission: true,
      },
    });
  }
}
