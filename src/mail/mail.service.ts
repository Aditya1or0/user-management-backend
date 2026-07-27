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

    this.from = this.configService.get<string>('mail.from') || process.env.MAIL_FROM || 'Nimbus <noreply@nimbus.io>';

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
    const { subject, html, text } = renderPasswordResetTemplate(data);
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
    const subject = 'Your Nimbus Login OTP Code';
    const text = `Your 6-digit Login OTP is: ${data.otp}`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; background-color: #09090b; color: #f4f4f5; border-radius: 8px;">
        <h2 style="color: #06b6d4;">KeyMaster</h2>
        <p>Your 6-digit Login OTP Code is:</p>
        <div style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #06b6d4; margin: 20px 0;">
          ${data.otp}
        </div>
        <p style="font-size: 12px; color: #71717a;">This code will expire in 10 minutes.</p>
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
