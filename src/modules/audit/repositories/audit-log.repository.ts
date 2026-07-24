import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';

export interface CreateAuditLogParams {
  organizationId?: string | null;
  userId?: string | null;
  action: AuditAction | string;
  entity: AuditEntity | string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async create(params: CreateAuditLogParams, tx?: PrismaClientOrTx): Promise<AuditLog> {
    return this.getClient(tx).auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue ?? Prisma.DbNull,
        newValue: params.newValue ?? Prisma.DbNull,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }
}
