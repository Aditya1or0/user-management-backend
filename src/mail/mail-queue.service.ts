import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { MAIL_QUEUE } from '../common/constants/queue.constants';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditEntity } from '../common/enums/audit-entity.enum';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { MailService } from './mail.service';

export interface WelcomeEmailJobData {
  userId: string;
  organizationId: string;
  email: string;
  firstName: string;
  organizationName: string;
  loginUrl?: string;
}

export interface InvitationEmailJobData {
  invitationId?: string;
  organizationId: string;
  email: string;
  invitationUrl: string;
  organizationName?: string;
  inviterName?: string;
  expiresAt?: Date | string;
}

export interface PasswordResetEmailJobData {
  userId: string;
  email: string;
  resetUrl: string;
  token?: string;
  otp?: string;
  firstName?: string;
  expiresAt?: Date | string;
}

export interface LoginOtpEmailJobData {
  userId: string;
  email: string;
  otp: string;
  firstName?: string;
}

@Injectable()
export class MailQueueService {
  private readonly logger = new Logger(MailQueueService.name);
  private readonly frontendUrl: string;

  constructor(
    @Optional() @InjectQueue(MAIL_QUEUE) private readonly mailQueue?: Queue,
    private readonly auditService?: AuditService,
    @Optional() @Inject(EMAIL_PROVIDER_TOKEN) private readonly mailService?: MailService,
    private readonly configService?: ConfigService,
  ) {
    this.frontendUrl = this.configService?.get<string>('mail.frontendUrl') || process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  async enqueueWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    const jobData: WelcomeEmailJobData = {
      ...data,
      loginUrl: data.loginUrl || `${this.frontendUrl}/login`,
    };

    try {
      if (this.mailQueue) {
        await this.mailQueue.add('welcome-email', jobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Enqueued welcome email job for ${data.email}`);
      } else if (this.mailService) {
        this.logger.warn(`BullMQ queue not available. Sending welcome email inline to ${data.email}`);
        await this.mailService.sendWelcomeEmail({
          recipientEmail: jobData.email,
          firstName: jobData.firstName,
          organizationName: jobData.organizationName,
          loginUrl: jobData.loginUrl!,
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
    const jobData: InvitationEmailJobData = {
      ...data,
      expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    try {
      if (this.mailQueue) {
        await this.mailQueue.add('invitation-email', jobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Enqueued invitation email job for ${data.email}`);
      } else if (this.mailService) {
        this.logger.warn(`BullMQ queue not available. Sending invitation email inline to ${data.email}`);
        await this.mailService.sendInvitationEmail({
          recipientEmail: jobData.email,
          organizationName: jobData.organizationName || 'Nimbus Workspace',
          inviterName: jobData.inviterName,
          invitationUrl: jobData.invitationUrl,
          expiresAt: jobData.expiresAt!,
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

  async enqueuePasswordResetEmail(data: PasswordResetEmailJobData): Promise<void> {
    const jobData: PasswordResetEmailJobData = {
      ...data,
      expiresAt: data.expiresAt || new Date(Date.now() + 60 * 60 * 1000),
    };

    try {
      if (this.mailQueue) {
        await this.mailQueue.add('password-reset-email', jobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Enqueued password reset email job for ${data.email}`);
      } else if (this.mailService) {
        this.logger.warn(`BullMQ queue not available. Sending password reset email inline to ${data.email}`);
        await this.mailService.sendPasswordResetEmail({
          recipientEmail: jobData.email,
          firstName: jobData.firstName,
          resetUrl: jobData.resetUrl,
          otp: jobData.otp,
          expiresAt: jobData.expiresAt!,
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          userId: data.userId,
          action: AuditAction.EMAIL_QUEUED,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'PASSWORD_RESET_EMAIL', recipient: data.email },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to enqueue password reset email for ${data.email}`, error);
    }
  }

  async enqueueLoginOtpEmail(data: LoginOtpEmailJobData): Promise<void> {
    try {
      if (this.mailQueue) {
        await this.mailQueue.add('login-otp-email', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
        this.logger.log(`Enqueued login OTP email job for ${data.email}`);
      } else if (this.mailService) {
        this.logger.warn(`BullMQ queue not available. Sending login OTP email inline to ${data.email}`);
        await this.mailService.sendLoginOtpEmail({
          recipientEmail: data.email,
          firstName: data.firstName,
          otp: data.otp,
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          userId: data.userId,
          action: AuditAction.EMAIL_QUEUED,
          entity: AuditEntity.EMAIL,
          newValue: { type: 'LOGIN_OTP_EMAIL', recipient: data.email },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to enqueue login OTP email for ${data.email}`, error);
    }
  }
}
