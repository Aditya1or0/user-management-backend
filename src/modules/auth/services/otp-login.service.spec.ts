import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpLoginService } from './otp-login.service';
import { PrismaService } from '../../../database/database.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { LoginOtpRepository } from '../repositories/login-otp.repository';
import { AuditService } from '../../audit/audit.service';
import { MailQueueService } from '../../../mail/mail-queue.service';
import { UserStatus } from '../../../common/enums/user-status.enum';

describe('OtpLoginService', () => {
  let service: OtpLoginService;
  let userRepository: jest.Mocked<UserRepository>;
  let organizationUserRepository: jest.Mocked<OrganizationUserRepository>;
  let loginOtpRepository: jest.Mocked<LoginOtpRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let auditService: jest.Mocked<AuditService>;
  let mailQueueService: jest.Mocked<MailQueueService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+1234567890',
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

  const mockOrganizationUser = {
    id: 'org-user-1',
    organizationId: 'org-uuid-1',
    userId: 'user-uuid-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    joinedAt: new Date(),
    invitedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      id: 'org-uuid-1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      status: 'ACTIVE' as any,
    },
  };

  const mockLoginOtpRecord = {
    id: 'login-otp-uuid-1',
    userId: 'user-uuid-1',
    otpHash: 'hashed-otp',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpLoginService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb({})),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth.loginOtpExpiresInMinutes') return 10;
              return null;
            }),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
          },
        },
        {
          provide: OrganizationUserRepository,
          useValue: {
            findUserOrganizations: jest.fn(),
          },
        },
        {
          provide: LoginOtpRepository,
          useValue: {
            create: jest.fn(),
            findByOtpHash: jest.fn(),
            markAsUsed: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-jwt-token-otp'),
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
            enqueueLoginOtpEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OtpLoginService>(OtpLoginService);
    userRepository = module.get(UserRepository);
    organizationUserRepository = module.get(OrganizationUserRepository);
    loginOtpRepository = module.get(LoginOtpRepository);
    jwtService = module.get(JwtService);
    auditService = module.get(AuditService);
    mailQueueService = module.get(MailQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendLoginOtp', () => {
    it('should generate login OTP, save record, record audit log, and queue email for valid active user', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      loginOtpRepository.create.mockResolvedValue(mockLoginOtpRecord as any);

      const result = await service.sendLoginOtp({ email: ' USER@EXAMPLE.COM ' });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(loginOtpRepository.create).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalled();
      expect(mailQueueService.enqueueLoginOtpEmail).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If an account exists for this email, a login OTP code has been sent.',
      });
    });

    it('should return generic success message without sending email if user does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.sendLoginOtp({ email: 'nonexistent@example.com' });

      expect(loginOtpRepository.create).not.toHaveBeenCalled();
      expect(mailQueueService.enqueueLoginOtpEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If an account exists for this email, a login OTP code has been sent.',
      });
    });
  });

  describe('loginWithOtp', () => {
    it('should authenticate user and return JWT token when valid OTP is provided', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      loginOtpRepository.findByOtpHash.mockResolvedValue(mockLoginOtpRecord as any);
      organizationUserRepository.findUserOrganizations.mockResolvedValue([mockOrganizationUser as any]);

      const result = await service.loginWithOtp({
        email: 'user@example.com',
        otp: ' 123456 ',
      });

      expect(loginOtpRepository.markAsUsed).toHaveBeenCalledWith(mockLoginOtpRecord.id, expect.anything());
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: mockUser.id, email: mockUser.email });
      expect(auditService.record).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-jwt-token-otp',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          phone: mockUser.phone,
          isActive: mockUser.isActive,
          createdAt: mockUser.createdAt,
        },
        organizations: [
          {
            id: 'org-uuid-1',
            name: 'Acme Corp',
            slug: 'acme-corp',
            status: 'ACTIVE',
          },
        ],
      });
    });

    it('should throw UnauthorizedException if OTP code is invalid or expired', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      loginOtpRepository.findByOtpHash.mockResolvedValue(null);

      await expect(
        service.loginWithOtp({ email: 'user@example.com', otp: '999999' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user account is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser as any);
      loginOtpRepository.findByOtpHash.mockResolvedValue(mockLoginOtpRecord as any);

      await expect(
        service.loginWithOtp({ email: 'user@example.com', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
