import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogRepository } from './repositories/audit-log.repository';

@Global()
@Module({
  providers: [AuditService, AuditLogRepository],
  exports: [AuditService, AuditLogRepository],
})
export class AuditModule {}
