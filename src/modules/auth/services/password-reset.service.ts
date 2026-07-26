import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/database.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { MailQueueService } from '../../../mail/mail-queue.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ResetPasswordOtpDto } from '../dto/reset-password-otp.dto';
import { hashToken } from '../../../common/utils/hash.util';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Generic OWASP response message
    const genericResponse = {
      message: 'If an account exists for this email, password reset instructions have been sent.',
    };

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user || !user.isActive || user.deletedAt) {
      return genericResponse;
    }

    // 1. Generate 32-byte token and 6-digit OTP code
    const rawToken = crypto.randomBytes(32).toString('hex');
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const tokenHash = hashToken(rawToken);
    const otpHash = hashToken(rawOtp);

    // 2. Read configurable timeout (default 60 min)
    const timeoutMinutes =
      this.configService.get<number>('auth.passwordResetExpiresInMinutes') || 60;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    // 3. Database Transaction
    await this.prisma.$transaction(async (tx) => {
      await this.passwordResetTokenRepository.create(
        {
          user: { connect: { id: user.id } },
          tokenHash,
          otpHash,
          expiresAt,
        },
        tx,
      );

      await this.auditService.record(
        {
          userId: user.id,
          action: AuditAction.PASSWORD_RESET_REQUESTED,
          entity: AuditEntity.USER,
          entityId: user.id,
          newValue: { email: normalizedEmail, expiresAt },
        },
        tx,
      );
    });

    // 4. Queue background email after transaction commits
    const frontendUrl = this.configService?.get<string>('mail.frontendUrl') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.mailQueueService.enqueuePasswordResetEmail({
      userId: user.id,
      email: normalizedEmail,
      resetUrl,
      token: rawToken,
      otp: rawOtp,
      firstName: user.firstName,
      expiresAt,
    });

    return genericResponse;
  }

  async resetPasswordWithToken(dto: ResetPasswordDto): Promise<{ message: string }> {
    const token = dto.token.trim();
    const tokenHash = hashToken(token);

    const resetToken = await this.passwordResetTokenRepository.findByTokenHash(tokenHash);
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const user = await this.userRepository.findById(resetToken.userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      await this.passwordResetTokenRepository.markAsUsed(resetToken.id, tx);

      await this.auditService.record(
        {
          userId: user.id,
          action: AuditAction.PASSWORD_RESET_COMPLETED,
          entity: AuditEntity.USER,
          entityId: user.id,
          newValue: { method: 'TOKEN' },
        },
        tx,
      );
    });

    return { message: 'Password has been reset successfully.' };
  }

  async resetPasswordWithOtp(dto: ResetPasswordOtpDto): Promise<{ message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user || !user.isActive || user.deletedAt) {
      throw new BadRequestException('Invalid or expired OTP code.');
    }

    const otpHash = hashToken(otp);
    const resetToken = await this.passwordResetTokenRepository.findByOtpHash(user.id, otpHash);

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired OTP code.');
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      await this.passwordResetTokenRepository.markAsUsed(resetToken.id, tx);

      await this.auditService.record(
        {
          userId: user.id,
          action: AuditAction.PASSWORD_RESET_COMPLETED,
          entity: AuditEntity.USER,
          entityId: user.id,
          newValue: { method: 'OTP' },
        },
        tx,
      );
    });

    return { message: 'Password has been reset successfully.' };
  }
}
