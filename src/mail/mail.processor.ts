import { Inject, Logger, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MAIL_QUEUE } from '../common/constants/queue.constants';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { MailService } from './mail.service';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditEntity } from '../common/enums/audit-entity.enum';
import {
  WelcomeEmailJobData,
  InvitationEmailJobData,
  PasswordResetEmailJobData,
  LoginOtpEmailJobData,
} from './mail-queue.service';

@Processor(MAIL_QUEUE)
@Injectable()
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly mailService: MailService,
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
      case 'password-reset-email':
        return this.handlePasswordResetEmail(job as Job<PasswordResetEmailJobData>);
      case 'login-otp-email':
        return this.handleLoginOtpEmail(job as Job<LoginOtpEmailJobData>);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleWelcomeEmail(job: Job<WelcomeEmailJobData>): Promise<boolean> {
    const { userId, organizationId, email, firstName, organizationName, loginUrl } = job.data;
    try {
      const sent = await this.mailService.sendWelcomeEmail({
        recipientEmail: email,
        firstName,
        organizationName,
        loginUrl: loginUrl || 'http://localhost:3000/login',
      });

      if (sent && this.auditService) {
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
      if (this.auditService) {
        await this.auditService.record({
          organizationId,
          userId,
          action: AuditAction.EMAIL_FAILED,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'WELCOME_EMAIL', recipient: email, error: error instanceof Error ? error.message : String(error) },
        });
      }
      throw error;
    }
  }

  private async handleInvitationEmail(job: Job<InvitationEmailJobData>): Promise<boolean> {
    const { invitationId, organizationId, email, invitationUrl, organizationName, inviterName, expiresAt } = job.data;
    try {
      const sent = await this.mailService.sendInvitationEmail({
        recipientEmail: email,
        organizationName: organizationName || 'KeyMaster Workspace',
        inviterName,
        invitationUrl,
        expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      if (sent && this.auditService) {
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
      if (this.auditService) {
        await this.auditService.record({
          organizationId,
          action: AuditAction.EMAIL_FAILED,
          entity: AuditEntity.EMAIL,
          entityId: invitationId,
          newValue: { type: 'INVITATION_EMAIL', recipient: email, error: error instanceof Error ? error.message : String(error) },
        });
      }
      throw error;
    }
  }

  private async handlePasswordResetEmail(job: Job<PasswordResetEmailJobData>): Promise<boolean> {
    const { userId, email, resetUrl, otp, firstName, expiresAt } = job.data;
    try {
      const sent = await this.mailService.sendPasswordResetEmail({
        recipientEmail: email,
        firstName,
        resetUrl,
        otp,
        expiresAt: expiresAt || new Date(Date.now() + 60 * 60 * 1000),
      });

      if (sent && this.auditService) {
        await this.auditService.record({
          userId,
          action: AuditAction.EMAIL_SENT,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'PASSWORD_RESET_EMAIL', recipient: email, jobId: job.id },
        });
      }
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
      if (this.auditService) {
        await this.auditService.record({
          userId,
          action: AuditAction.EMAIL_FAILED,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'PASSWORD_RESET_EMAIL', recipient: email, error: error instanceof Error ? error.message : String(error) },
        });
      }
      throw error;
    }
  }

  private async handleLoginOtpEmail(job: Job<LoginOtpEmailJobData>): Promise<boolean> {
    const { userId, email, otp, firstName } = job.data;
    try {
      const sent = await this.mailService.sendLoginOtpEmail({
        recipientEmail: email,
        firstName,
        otp,
      });

      if (sent && this.auditService) {
        await this.auditService.record({
          userId,
          action: AuditAction.EMAIL_SENT,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'LOGIN_OTP_EMAIL', recipient: email, jobId: job.id },
        });
      }
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send login OTP email to ${email}`, error);
      if (this.auditService) {
        await this.auditService.record({
          userId,
          action: AuditAction.EMAIL_FAILED,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'LOGIN_OTP_EMAIL', recipient: email, error: error instanceof Error ? error.message : String(error) },
        });
      }
      throw error;
    }
  }
}
