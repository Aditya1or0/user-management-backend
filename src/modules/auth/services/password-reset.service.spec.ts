import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetService } from './password-reset.service';
import { PrismaService } from '../../../database/database.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { MailQueueService } from '../../../mail/mail-queue.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordResetTokenRepository: jest.Mocked<PasswordResetTokenRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let auditService: jest.Mocked<AuditService>;
  let mailQueueService: jest.Mocked<MailQueueService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: 'old-hashed-password',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: null,
    avatarUrl: null,
    timezone: 'UTC',
    locale: 'en-US',
    emailVerified: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockResetTokenRecord = {
    id: 'reset-token-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'hashed-token',
    otpHash: 'hashed-otp',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb({ user: { update: jest.fn() } })),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth.passwordResetExpiresInMinutes') return 60;
              return null;
            }),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
          },
        },
        {
          provide: PasswordResetTokenRepository,
          useValue: {
            create: jest.fn(),
            findByTokenHash: jest.fn(),
            findByOtpHash: jest.fn(),
            markAsUsed: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn().mockResolvedValue('new-hashed-password'),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: MailQueueService,
          useValue: {
            enqueuePasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    userRepository = module.get(UserRepository);
    passwordResetTokenRepository = module.get(PasswordResetTokenRepository);
    passwordService = module.get(PasswordService);
    auditService = module.get(AuditService);
    mailQueueService = module.get(MailQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should generate reset tokens, queue email, and return generic success message for active user', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      passwordResetTokenRepository.create.mockResolvedValue(mockResetTokenRecord as any);

      const result = await service.forgotPassword({ email: ' USER@EXAMPLE.COM ' });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(passwordResetTokenRepository.create).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalled();
      expect(mailQueueService.enqueuePasswordResetEmail).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If an account exists for this email, password reset instructions have been sent.',
      });
    });

    it('should return generic success message without sending email if user does not exist (OWASP anti-enumeration)', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nonexistent@example.com' });

      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
      expect(mailQueueService.enqueuePasswordResetEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If an account exists for this email, password reset instructions have been sent.',
      });
    });
  });

  describe('resetPasswordWithToken', () => {
    it('should reset password when a valid token is provided', async () => {
      passwordResetTokenRepository.findByTokenHash.mockResolvedValue(mockResetTokenRecord as any);
      userRepository.findById.mockResolvedValue(mockUser as any);

      const result = await service.resetPasswordWithToken({
        token: ' valid-raw-token ',
        newPassword: 'newSecretPassword123',
      });

      expect(passwordService.hash).toHaveBeenCalledWith('newSecretPassword123');
      expect(passwordResetTokenRepository.markAsUsed).toHaveBeenCalledWith(mockResetTokenRecord.id, expect.anything());
      expect(result).toEqual({ message: 'Password has been reset successfully.' });
    });

    it('should throw BadRequestException if token is missing or invalid', async () => {
      passwordResetTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(
        service.resetPasswordWithToken({ token: 'invalid-token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is already used', async () => {
      const usedToken = { ...mockResetTokenRecord, usedAt: new Date() };
      passwordResetTokenRepository.findByTokenHash.mockResolvedValue(usedToken as any);

      await expect(
        service.resetPasswordWithToken({ token: 'used-token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      const expiredToken = { ...mockResetTokenRecord, expiresAt: new Date(Date.now() - 1000) };
      passwordResetTokenRepository.findByTokenHash.mockResolvedValue(expiredToken as any);

      await expect(
        service.resetPasswordWithToken({ token: 'expired-token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPasswordWithOtp', () => {
    it('should reset password when a valid 6-digit OTP code is provided', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      passwordResetTokenRepository.findByOtpHash.mockResolvedValue(mockResetTokenRecord as any);

      const result = await service.resetPasswordWithOtp({
        email: 'user@example.com',
        otp: ' 123456 ',
        newPassword: 'newSecretPassword123',
      });

      expect(passwordService.hash).toHaveBeenCalledWith('newSecretPassword123');
      expect(passwordResetTokenRepository.markAsUsed).toHaveBeenCalledWith(mockResetTokenRecord.id, expect.anything());
      expect(result).toEqual({ message: 'Password has been reset successfully.' });
    });

    it('should throw BadRequestException if OTP code is invalid or expired', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      passwordResetTokenRepository.findByOtpHash.mockResolvedValue(null);

      await expect(
        service.resetPasswordWithOtp({
          email: 'user@example.com',
          otp: '999999',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
