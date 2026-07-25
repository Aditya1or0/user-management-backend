import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginService } from './login.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { UserStatus } from '../../../common/enums/user-status.enum';

describe('LoginService', () => {
  let loginService: LoginService;
  let userRepository: jest.Mocked<UserRepository>;
  let organizationUserRepository: jest.Mocked<OrganizationUserRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let jwtService: jest.Mocked<JwtService>;
  let auditService: jest.Mocked<AuditService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'John',
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
    email: 'test@example.com',
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
      logoUrl: null,
      website: null,
      timezone: null,
      ownerId: 'user-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
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
          provide: PasswordService,
          useValue: {
            compare: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
      ],
    }).compile();

    loginService = module.get<LoginService>(LoginService);
    userRepository = module.get(UserRepository);
    organizationUserRepository = module.get(OrganizationUserRepository);
    passwordService = module.get(PasswordService);
    jwtService = module.get(JwtService);
    auditService = module.get(AuditService);
  });

  it('should be defined', () => {
    expect(loginService).toBeDefined();
  });

  describe('successful login & token generation', () => {
    it('should authenticate user, verify password, generate token, and record audit log', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(true);
      organizationUserRepository.findUserOrganizations.mockResolvedValue([mockOrganizationUser as any]);
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');

      const result = await loginService.login({
        email: 'TEST@EXAMPLE.COM ',
        password: 'validPassword123',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(passwordService.compare).toHaveBeenCalledWith('validPassword123', mockUser.passwordHash);
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: mockUser.id, email: mockUser.email });
      expect(auditService.record).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
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
  });

  describe('authentication error handling & status checks', () => {
    it('should throw generic UnauthorizedException when email is not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        loginService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password.'));
    });

    it('should throw generic UnauthorizedException when password verification fails', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        loginService.login({
          email: 'test@example.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password.'));

      expect(passwordService.compare).toHaveBeenCalledWith('wrongPassword', mockUser.passwordHash);
    });

    it('should throw generic UnauthorizedException when user account is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser as any);
      passwordService.compare.mockResolvedValue(true);

      await expect(
        loginService.login({
          email: 'test@example.com',
          password: 'validPassword123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password.'));
    });

    it('should throw generic UnauthorizedException when user account is deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      userRepository.findByEmail.mockResolvedValue(deletedUser as any);
      passwordService.compare.mockResolvedValue(true);

      await expect(
        loginService.login({
          email: 'test@example.com',
          password: 'validPassword123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password.'));
    });

    it('should throw generic UnauthorizedException when all user memberships are suspended', async () => {
      const suspendedOrgUser = { ...mockOrganizationUser, status: UserStatus.SUSPENDED };
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(true);
      organizationUserRepository.findUserOrganizations.mockResolvedValue([suspendedOrgUser as any]);

      await expect(
        loginService.login({
          email: 'test@example.com',
          password: 'validPassword123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password.'));
    });
  });
});
