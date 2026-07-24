import { Inject, Logger, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MAIL_QUEUE } from '../common/constants/queue.constants';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import type { IEmailProvider } from './providers/email-provider.interface';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditEntity } from '../common/enums/audit-entity.enum';
import { WelcomeEmailJobData, InvitationEmailJobData } from './mail-queue.service';

@Processor(MAIL_QUEUE)
@Injectable()
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider: IEmailProvider,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing background mail job: ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case 'welcome-email':
        return this.handleWelcomeEmail(job as Job<WelcomeEmailJobData>);
      case 'invitation-email':
        return this.handleInvitationEmail(job as Job<InvitationEmailJobData>);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleWelcomeEmail(job: Job<WelcomeEmailJobData>): Promise<boolean> {
    const { userId, organizationId, email, firstName, organizationName } = job.data;
    try {
      const sent = await this.emailProvider.sendEmail({
        to: email,
        subject: `Welcome to ${organizationName}!`,
        body: `Hi ${firstName},\n\nWelcome to ${organizationName}! Your account has been created.`,
      });

      if (sent) {
        await this.auditService.record({
          organizationId,
          userId,
          action: AuditAction.EMAIL_SENT,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'WELCOME_EMAIL', recipient: email, jobId: job.id },
        });
      }
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
      await this.auditService.record({
        organizationId,
        userId,
        action: AuditAction.EMAIL_FAILED,
        entity: AuditEntity.EMAIL,
        newValue: { type: 'WELCOME_EMAIL', recipient: email, error: error.message },
      });
      throw error;
    }
  }

  private async handleInvitationEmail(job: Job<InvitationEmailJobData>): Promise<boolean> {
    const { invitationId, organizationId, email, token } = job.data;
    try {
      const sent = await this.emailProvider.sendEmail({
        to: email,
        subject: 'You have been invited to join an organization',
        body: `You have been invited to join an organization. Click here to accept: ${token}`,
      });

      if (sent) {
        await this.auditService.record({
          organizationId,
          action: AuditAction.EMAIL_SENT,
          entity: AuditEntity.EMAIL,
          entityId: invitationId,
          newValue: { type: 'INVITATION_EMAIL', recipient: email, jobId: job.id },
        });
      }
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${email}`, error);
      await this.auditService.record({
        organizationId,
        action: AuditAction.EMAIL_FAILED,
        entity: AuditEntity.EMAIL,
        entityId: invitationId,
        newValue: { type: 'INVITATION_EMAIL', recipient: email, error: error.message },
      });
      throw error;
    }
  }
}
