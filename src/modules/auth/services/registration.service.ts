import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationRepository } from '../../organizations/repositories/organization.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { RoleProvisioningService } from '../../organizations/services/role-provisioning.service';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { MailQueueService } from '../../../mail/mail-queue.service';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { SystemRole } from '../../../common/enums/system-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationUserRepository: OrganizationUserRepository,
    private readonly roleProvisioningService: RoleProvisioningService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Friendly early validation lookup
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // 2. Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // 3. Atomic Database Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // a. Create User identity
      const user = await this.userRepository.create(
        {
          email: normalizedEmail,
          publicSlug: 'user-' + Math.random().toString(36).substring(2, 6),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
        tx,
      );

      // b. Create Organization with atomic slug retry handling for race condition protection
      const organization = await this.organizationRepository.createWithSlugRetry(
        dto.organizationName,
        {
          name: dto.organizationName,
          owner: { connect: { id: user.id } },
        },
        tx,
      );

      // c. Create OrganizationUser membership
      const orgUser = await this.organizationUserRepository.create(
        {
          organization: { connect: { id: organization.id } },
          user: { connect: { id: user.id } },
          email: user.email,
          status: UserStatus.ACTIVE,
          joinedAt: new Date(),
        },
        tx,
      );

      // d. Provision system OWNER role & assign to member
      const ownerRole = await this.roleProvisioningService.provisionSystemRole(
        organization.id,
        SystemRole.OWNER,
        tx,
      );

      await this.roleProvisioningService.assignRoleToMember(orgUser.id, ownerRole.id, tx);

      // e. Create AuditLog inside transaction
      await this.auditService.record(
        {
          organizationId: organization.id,
          userId: user.id,
          action: AuditAction.USER_REGISTERED,
          entity: AuditEntity.ORGANIZATION,
          entityId: organization.id,
          newValue: {
            email: user.email,
            organizationName: organization.name,
            slug: organization.slug,
          },
        },
        tx,
      );

      return { user, organization };
    });

    // 4. Queue welcome email asynchronously ONLY after transaction completion
    await this.mailQueueService.enqueueWelcomeEmail({
      userId: result.user.id,
      organizationId: result.organization.id,
      email: result.user.email,
      firstName: result.user.firstName,
      organizationName: result.organization.name,
    });

    // 5. Return clean response DTO
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        phone: result.user.phone || undefined,
        isActive: result.user.isActive,
        createdAt: result.user.createdAt,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        status: result.organization.status,
      },
    };
  }
}
