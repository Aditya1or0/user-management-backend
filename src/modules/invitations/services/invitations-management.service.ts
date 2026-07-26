import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/database.service';
import { InvitationRepository } from '../repositories/invitation.repository';
import { OrganizationRepository } from '../../organizations/repositories/organization.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { AuditService } from '../../audit/audit.service';
import { MailQueueService } from '../../../mail/mail-queue.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationResponseDto } from '../dto/invitation-response.dto';
import { hashToken } from '../../../common/utils/hash.util';
import { SystemRole } from '../../../common/enums/system-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';

@Injectable()
export class InvitationsManagementService {
  private readonly logger = new Logger(InvitationsManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly invitationRepository: InvitationRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationUserRepository: OrganizationUserRepository,
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly mailQueueService: MailQueueService,
  ) {}

  /**
   * Helper to assert that an actor has OWNER or ADMIN role in an organization.
   */
  private assertAuthorizedActor(
    membership: any,
    organizationId: string,
  ): void {
    if (
      !membership ||
      membership.status === UserStatus.SUSPENDED ||
      membership.status === UserStatus.REMOVED
    ) {
      throw new ForbiddenException('You do not belong to this organization.');
    }

    const hasAuthorizedRole = membership.roles?.some((mr: any) => {
      const roleKey = mr.role?.key;
      const roleName = mr.role?.name;
      return (
        roleKey === SystemRole.OWNER ||
        roleKey === SystemRole.ADMIN ||
        roleName === SystemRole.OWNER ||
        roleName === SystemRole.ADMIN ||
        roleName === 'Owner' ||
        roleName === 'Admin'
      );
    });

    if (!hasAuthorizedRole) {
      throw new ForbiddenException(
        'You do not have permission to manage invitations in this organization.',
      );
    }
  }

  async createInvitation(
    actorId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Verify organization exists
    const organization = await this.organizationRepository.findById(dto.organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    // 2. Verify actor membership & permission (OWNER or ADMIN)
    const actorMembership = await this.organizationUserRepository.findByUserAndOrganization(
      actorId,
      dto.organizationId,
    );
    this.assertAuthorizedActor(actorMembership, dto.organizationId);

    // 3. Prevent self-invite
    const actorUser = await this.userRepository.findById(actorId);
    if (actorUser && actorUser.email.trim().toLowerCase() === normalizedEmail) {
      throw new BadRequestException('You cannot invite yourself.');
    }

    // 4. Check if target user is already an active member of this organization
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      const existingMembership = await this.organizationUserRepository.findByUserAndOrganization(
        existingUser.id,
        dto.organizationId,
      );
      if (
        existingMembership &&
        (existingMembership.status === UserStatus.ACTIVE ||
          existingMembership.status === UserStatus.INVITED)
      ) {
        throw new ConflictException('User is already a member of this organization.');
      }
    }

    // 5. Prevent duplicate active invitations for the same organization + email
    const activeInvitation = await this.invitationRepository.findActiveInvitation(
      dto.organizationId,
      normalizedEmail,
    );
    if (activeInvitation) {
      throw new ConflictException(
        'An active invitation already exists for this email in this organization.',
      );
    }

    // 6. Generate secure random token & SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // 7. Set 7-day expiration time
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 8. Run Database Transaction (Invitation + Audit Log)
    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await this.invitationRepository.create(
        {
          organization: { connect: { id: dto.organizationId } },
          email: normalizedEmail,
          tokenHash,
          invitedById: actorId,
          expiresAt,
        },
        tx,
      );

      await this.auditService.record(
        {
          organizationId: dto.organizationId,
          userId: actorId,
          action: AuditAction.INVITATION_SENT,
          entity: AuditEntity.INVITATION,
          entityId: created.id,
          newValue: { email: normalizedEmail, expiresAt },
        },
        tx,
      );

      return created;
    });

    // 9. Queue background email ONLY AFTER transaction succeeds
    const frontendUrl = this.configService?.get<string>('mail.frontendUrl') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const invitationUrl = `${frontendUrl}/accept-invitation?token=${rawToken}`;
    const inviterName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}`.trim() : undefined;

    await this.mailQueueService.enqueueInvitationEmail({
      invitationId: invitation.id,
      organizationId: dto.organizationId,
      email: normalizedEmail,
      invitationUrl,
      organizationName: organization.name,
      inviterName,
      expiresAt: invitation.expiresAt,
    });

    // 10. Return clean invitation metadata (never the raw token)
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      invitedById: invitation.invitedById,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
    };
  }

  async revokeInvitation(
    actorId: string,
    invitationId: string,
  ): Promise<InvitationResponseDto> {
    // 1. Fetch invitation by ID
    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    // 2. Reject if already accepted or revoked
    if (invitation.acceptedAt) {
      throw new ConflictException('Cannot revoke an already accepted invitation.');
    }

    if (invitation.revokedAt) {
      throw new ConflictException('Invitation is already revoked.');
    }

    // 3. Verify actor membership & permission in the invitation's organization
    const actorMembership = await this.organizationUserRepository.findByUserAndOrganization(
      actorId,
      invitation.organizationId,
    );
    this.assertAuthorizedActor(actorMembership, invitation.organizationId);

    // 4. Run Database Transaction (Revocation + Audit Log)
    const revoked = await this.prisma.$transaction(async (tx) => {
      const updated = await this.invitationRepository.revoke(invitationId, tx);

      await this.auditService.record(
        {
          organizationId: invitation.organizationId,
          userId: actorId,
          action: AuditAction.INVITATION_REVOKED,
          entity: AuditEntity.INVITATION,
          entityId: updated.id,
          newValue: { email: invitation.email, revokedAt: updated.revokedAt },
        },
        tx,
      );

      return updated;
    });

    return {
      id: revoked.id,
      organizationId: revoked.organizationId,
      email: revoked.email,
      invitedById: revoked.invitedById,
      expiresAt: revoked.expiresAt,
      acceptedAt: revoked.acceptedAt,
      revokedAt: revoked.revokedAt,
      createdAt: revoked.createdAt,
    };
  }
}
