import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { InvitationRepository } from '../../invitations/repositories/invitation.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { RoleProvisioningService } from '../../organizations/services/role-provisioning.service';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { SystemRole } from '../../../common/enums/system-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';
import { hashToken } from '../../../common/utils/hash.util';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationRepository: InvitationRepository,
    private readonly userRepository: UserRepository,
    private readonly organizationUserRepository: OrganizationUserRepository,
    private readonly roleProvisioningService: RoleProvisioningService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async acceptInvite(dto: AcceptInviteDto): Promise<AuthResponseDto> {
    // 1. Hash the raw incoming token before database lookup
    const tokenHash = hashToken(dto.token);
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);

    if (!invitation || invitation.revokedAt) {
      throw new NotFoundException('Invitation not found or revoked');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation already accepted');
    }

    const normalizedEmail = invitation.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      // 2. Atomically mark invitation as accepted to prevent double-acceptance race conditions
      await this.invitationRepository.markAsAcceptedAtomic(invitation.id, tx);

      // 3. Create User
      const user = await this.userRepository.create(
        {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        tx,
      );

      // 4. Resolve the inviter's OrganizationUser ID if they still belong to the organization
      let inviterOrgUserId: string | undefined;
      if (invitation.invitedById) {
        const inviterMembership = await this.organizationUserRepository.findByUserAndOrganization(
          invitation.invitedById,
          invitation.organizationId,
          tx,
        );
        if (inviterMembership) {
          inviterOrgUserId = inviterMembership.id;
        }
      }

      // 5. Create Membership with UserStatus enum
      const orgUser = await this.organizationUserRepository.create(
        {
          organization: { connect: { id: invitation.organizationId } },
          user: { connect: { id: user.id } },
          email: user.email,
          status: UserStatus.ACTIVE,
          joinedAt: new Date(),
          invitedByMember: inviterOrgUserId
            ? { connect: { id: inviterOrgUserId } }
            : undefined,
        },
        tx,
      );

      // 5. Provision & assign default MEMBER role
      const memberRole = await this.roleProvisioningService.provisionSystemRole(
        invitation.organizationId,
        SystemRole.MEMBER,
        tx,
      );
      await this.roleProvisioningService.assignRoleToMember(orgUser.id, memberRole.id, tx);

      // 6. Create AuditLog inside transaction
      await this.auditService.record(
        {
          organizationId: invitation.organizationId,
          userId: user.id,
          action: AuditAction.INVITATION_ACCEPTED,
          entity: AuditEntity.INVITATION,
          entityId: invitation.id,
          newValue: { email: user.email, acceptedAt: new Date() },
        },
        tx,
      );

      return { user, organization: invitation.organization };
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
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
