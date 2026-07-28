import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/database.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { LoginOtpRepository } from '../repositories/login-otp.repository';
import { AuditService } from '../../audit/audit.service';
import { MailQueueService } from '../../../mail/mail-queue.service';
import { TokenService } from './token.service';
import { SendLoginOtpDto } from '../dto/send-login-otp.dto';
import { LoginOtpDto } from '../dto/login-otp.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { hashToken } from '../../../common/utils/hash.util';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';
import { SessionContext } from '../../../common/types/session-context.interface';

@Injectable()
export class OtpLoginService {
  private readonly logger = new Logger(OtpLoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly organizationUserRepository: OrganizationUserRepository,
    private readonly loginOtpRepository: LoginOtpRepository,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async sendLoginOtp(dto: SendLoginOtpDto): Promise<{ message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const genericResponse = {
      message: 'If an account exists for this email, a login OTP code has been sent.',
    };

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user || !user.isActive || user.deletedAt) {
      return genericResponse;
    }

    // 1. Generate 6-digit numeric OTP code
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashToken(rawOtp);

    // 2. Read configurable timeout (default 10 min)
    const timeoutMinutes =
      this.configService.get<number>('auth.loginOtpExpiresInMinutes') || 10;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    // 3. Database Transaction
    await this.prisma.$transaction(async (tx) => {
      await this.loginOtpRepository.create(
        {
          user: { connect: { id: user.id } },
          otpHash,
          expiresAt,
        },
        tx,
      );

      await this.auditService.record(
        {
          userId: user.id,
          action: AuditAction.LOGIN_OTP_REQUESTED,
          entity: AuditEntity.USER,
          entityId: user.id,
          newValue: { email: normalizedEmail, expiresAt },
        },
        tx,
      );
    });

    // 4. Queue background email after transaction commits
    await this.mailQueueService.enqueueLoginOtpEmail({
      userId: user.id,
      email: normalizedEmail,
      otp: rawOtp,
    });

    return genericResponse;
  }

  async loginWithOtp(dto: LoginOtpDto, context: SessionContext): Promise<LoginResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    // 1. Find user by email
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid email or OTP code.');
    }

    // 2. Compute OTP hash & look up record
    const otpHash = hashToken(otp);
    const otpRecord = await this.loginOtpRepository.findByOtpHash(user.id, otpHash);

    if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid email or OTP code.');
    }

    // 3. Account status checks
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or OTP code.');
    }

    // 4. Check OrganizationUser membership status (suspended)
    const memberships = await this.organizationUserRepository.findUserOrganizations(user.id);
    if (
      memberships.length > 0 &&
      memberships.every((m) => m.status === UserStatus.SUSPENDED)
    ) {
      throw new UnauthorizedException('Invalid email or OTP code.');
    }

    // 5. Database Transaction (mark OTP as used + record audit log)
    await this.prisma.$transaction(async (tx) => {
      await this.loginOtpRepository.markAsUsed(otpRecord.id, tx);

      await this.auditService.record(
        {
          userId: user.id,
          action: AuditAction.LOGIN_OTP_USED,
          entity: AuditEntity.USER,
          entityId: user.id,
          newValue: { email: normalizedEmail },
        },
        tx,
      );

      await this.auditService.record(
        {
          userId: user.id,
          action: AuditAction.USER_LOGGED_IN,
          entity: AuditEntity.USER,
          entityId: user.id,
          newValue: { email: normalizedEmail, method: 'OTP', loggedInAt: new Date() },
        },
        tx,
      );
    });

    const activeOrganizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      status: m.organization.status,
    }));
    const organizationId = activeOrganizations.length > 0 ? activeOrganizations[0].id : undefined;

    // 6. Generate Session and Tokens via TokenService
    const { accessToken, refreshToken } = await this.tokenService.createSessionTokens(user, context);

    // 7. Format clean DTO response
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || undefined,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      organizations: activeOrganizations,
    };
  }
}

