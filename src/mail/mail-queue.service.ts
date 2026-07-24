import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { MAIL_QUEUE } from '../common/constants/queue.constants';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditEntity } from '../common/enums/audit-entity.enum';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import type { IEmailProvider } from './providers/email-provider.interface';

export interface WelcomeEmailJobData {
  userId: string;
  organizationId: string;
  email: string;
  firstName: string;
  organizationName: string;
}

export interface InvitationEmailJobData {
  invitationId: string;
  organizationId: string;
  email: string;
  token: string;
}

@Injectable()
export class MailQueueService {
  private readonly logger = new Logger(MailQueueService.name);

  constructor(
    @Optional() @InjectQueue(MAIL_QUEUE) private readonly mailQueue?: Queue,
    private readonly auditService?: AuditService,
    @Optional() @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider?: IEmailProvider,
  ) {}

  async enqueueWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    try {
      if (this.mailQueue) {
        await this.mailQueue.add('welcome-email', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Enqueued welcome email job for ${data.email}`);
      } else if (this.emailProvider) {
        // Direct fallback if queue is disabled
        this.logger.warn(`BullMQ mailQueue not connected. Sending welcome email inline to ${data.email}`);
        await this.emailProvider.sendEmail({
          to: data.email,
          subject: `Welcome to ${data.organizationName}`,
          body: `Hi ${data.firstName}, welcome to ${data.organizationName}!`,
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          organizationId: data.organizationId,
          userId: data.userId,
          action: AuditAction.EMAIL_QUEUED,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'WELCOME_EMAIL', recipient: data.email },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to enqueue welcome email for ${data.email}`, error);
    }
  }

  async enqueueInvitationEmail(data: InvitationEmailJobData): Promise<void> {
    try {
      if (this.mailQueue) {
        await this.mailQueue.add('invitation-email', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Enqueued invitation email job for ${data.email}`);
      } else if (this.emailProvider) {
        this.logger.warn(`BullMQ mailQueue not connected. Sending invitation email inline to ${data.email}`);
        await this.emailProvider.sendEmail({
          to: data.email,
          subject: `You have been invited to join an organization`,
          body: `Use your invitation token: ${data.token}`,
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          organizationId: data.organizationId,
          action: AuditAction.EMAIL_QUEUED,
          entity: AuditEntity.EMAIL,
          entityId: data.invitationId,
          newValue: { type: 'INVITATION_EMAIL', recipient: data.email },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to enqueue invitation email for ${data.email}`, error);
    }
  }
}
