import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  InvitationEmailData,
  PasswordResetEmailData,
  WelcomeEmailData,
  LoginOtpEmailData,
} from './interfaces/mail-job.interface';
import { renderInvitationTemplate } from './templates/invitation.template';
import { renderPasswordResetTemplate } from './templates/password-reset.template';
import { renderPasswordSetupTemplate } from './templates/password-setup.template';
import { renderWelcomeTemplate } from './templates/welcome.template';
import { IEmailProvider, SendEmailPayload } from './providers/email-provider.interface';

@Injectable()
export class MailService implements OnModuleInit, IEmailProvider {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host') || process.env.MAIL_HOST || 'smtp.gmail.com';
    const port = Number(this.configService.get<number>('mail.port')) || Number(process.env.MAIL_PORT) || 587;
    const secure = this.configService.get<boolean>('mail.secure') ?? process.env.MAIL_SECURE === 'true';
    const user = this.configService.get<string>('mail.user') || process.env.MAIL_USER || '';
    const pass = this.configService.get<string>('mail.pass') || process.env.MAIL_PASSWORD || process.env.MAIL_PASS || '';

    this.from = this.configService.get<string>('mail.from') || process.env.MAIL_FROM || 'KeyMaster <noreply@keymaster.io>';

    this.logger.log(`Initializing Nodemailer transporter (Host: ${host}, Port: ${port}, Secure: ${secure}, User: ${user ? user : 'NONE'})`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    const user = this.configService.get<string>('mail.user') || process.env.MAIL_USER;
    if (user && process.env.NODE_ENV !== 'test') {
      // Run verify asynchronously in the background to prevent blocking server bootstrap
      this.transporter
        .verify()
        .then(() => {
          this.logger.log('Nodemailer transporter SMTP connection verified successfully.');
        })
        .catch((error) => {
          this.logger.warn(`SMTP verification failed on startup: ${error instanceof Error ? error.message : error}`);
        });
    }
  }

  /**
   * Generic send function compliant with IEmailProvider
   */
  async sendEmail(payload: SendEmailPayload): Promise<boolean> {
    try {
      this.logger.log(`Dispatching email to: ${payload.to} | Subject: "${payload.subject}"`);
      const info = await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        html: payload.html || payload.body,
      });

      this.logger.log(`Email dispatched successfully to ${payload.to} (MessageId: ${info.messageId})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to dispatch email to ${payload.to}`, error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    const { subject, html, text } = renderInvitationTemplate(data);
    return this.sendEmail({
      to: data.recipientEmail,
      subject,
      body: text,
      html,
    });
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    const { subject, html, text } = data.isProvisioning
      ? renderPasswordSetupTemplate(data)
      : renderPasswordResetTemplate(data);

    return this.sendEmail({
      to: data.recipientEmail,
      subject,
      body: text,
      html,
    });
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    const { subject, html, text } = renderWelcomeTemplate(data);
    return this.sendEmail({
      to: data.recipientEmail,
      subject,
      body: text,
      html,
    });
  }

  async sendLoginOtpEmail(data: LoginOtpEmailData): Promise<boolean> {
    const subject = 'Your KeyMaster Login OTP Code';
    const text = `Your 6-digit Login OTP is: ${data.otp}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; background-color: #f9fafb; color: #374151;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="padding: 32px 32px 24px; border-bottom: 1px solid #f3f4f6; text-align: left;">
            <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; text-decoration: none;">
              <span style="color: #0891b2;">⌘</span> <span style="color: #374151;">KeyMaster</span>
            </div>
          </div>
          <div style="padding: 32px; line-height: 1.6;">
            <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px;">Login Verification</h1>
            <p style="font-size: 15px; color: #4b5563; margin: 0 0 24px;">Your 6-digit Login OTP Code is:</p>
            <div style="background-color: #ecfeff; border: 1px solid #cffafe; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
              <div style="font-family: monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0891b2; margin: 0;">${data.otp}</div>
            </div>
            <p style="font-size: 13px; color: #6b7280; text-align: center;">This code will expire in 10 minutes. Do not share it with anyone.</p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.recipientEmail,
      subject,
      body: text,
      html,
    });
  }
}
