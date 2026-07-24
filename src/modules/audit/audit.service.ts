import { Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import { AuditLogRepository, CreateAuditLogParams } from './repositories/audit-log.repository';
import { PrismaClientOrTx } from '../../common/types/prisma.type';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(params: CreateAuditLogParams, tx?: PrismaClientOrTx): Promise<AuditLog> {
    try {
      const log = await this.auditLogRepository.create(params, tx);
      this.logger.log(`AuditLog created: [${params.action}] entity=${params.entity} entityId=${params.entityId || 'N/A'}`);
      return log;
    } catch (error) {
      this.logger.error(`Failed to create audit log for action ${params.action}`, error);
      throw error;
    }
  }
}
