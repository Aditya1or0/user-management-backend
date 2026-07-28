import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { CacheService } from '../../../cache/cache.service';
import { MemberRepository } from '../repositories/member.repository';
import { MemberQueryDto } from '../dto/member-query.dto';
import { CreateMemberDto } from '../dto/create-member.dto';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { MemberResponseDto } from '../dto/member-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generatePublicSlug } from '../../../common/utils/slug.util';
import { PasswordResetService } from '../../auth/services/password-reset.service';

@Injectable()
export class MembersService {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(
    organizationId: string,
    query: MemberQueryDto,
  ): Promise<PaginatedResponseDto<MemberResponseDto>> {
    const [items, total] = await this.memberRepository.findManyPaginated(organizationId, query);
    const page = query.page || 1;
    const limit = query.limit || 10;

    return new PaginatedResponseDto(items.map(MemberResponseDto.from), total, page, limit);
  }

  // ─── Single ──────────────────────────────────────────────────────────────────

  async findOne(memberId: string, organizationId: string): Promise<MemberResponseDto> {
    const member = await this.memberRepository.findById(memberId, organizationId);
    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }
    return MemberResponseDto.from(member);
  }

  async findOneBySlug(publicSlug: string, organizationId: string): Promise<MemberResponseDto> {
    const member = await this.memberRepository.findByUserSlug(publicSlug, organizationId);
    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }
    return MemberResponseDto.from(member);
  }

  // ─── Create (admin provision) ────────────────────────────────────────────────

  async create(
    organizationId: string,
    dto: CreateMemberDto,
    requestingUser?: any,
    organization?: any,
  ): Promise<MemberResponseDto> {
    const email = dto.email.trim().toLowerCase();

    // Check if already a member
    const existing = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_email: { organizationId, email },
      },
    });
    if (existing) {
      throw new ConflictException('A member with this email already exists in the organization.');
    }

    // Validate roleIds if supplied
    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.validateRolesInOrg(dto.roleIds, organizationId);
    }

    // Find or create global User
    let user = await this.prisma.user.findUnique({ where: { email } });
    const tempPasswordHash = await bcrypt.hash(
      `KeyMaster!${Math.random().toString(36).slice(2, 10)}`,
      10,
    );

    const orgUser = await this.prisma.$transaction(async (tx) => {
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            publicSlug: generatePublicSlug(`${dto.firstName} ${dto.lastName}`),
            firstName: dto.firstName,
            lastName: dto.lastName,
            passwordHash: tempPasswordHash,
            phone: dto.phone ?? null,
            emailVerified: false,
            isActive: true,
          },
        });
      }

      const member = await tx.organizationUser.create({
        data: {
          organizationId,
          userId: user!.id,
          email,
          status: UserStatus.ACTIVE,
          joinedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              publicSlug: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
          roles: { include: { role: { select: { id: true, name: true, key: true, isSystem: true } } } },
        },
      });

      if (dto.roleIds && dto.roleIds.length > 0) {
        await tx.memberRole.createMany({
          data: dto.roleIds.map((roleId) => ({ memberId: member.id, roleId })),
        });
      }

      return tx.organizationUser.findFirst({
        where: { id: member.id },
        include: {
          user: {
            select: {
              id: true,
              publicSlug: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
          roles: { include: { role: { select: { id: true, name: true, key: true, isSystem: true } } } },
        },
      });
    });

    // Send a welcome/password setup email using the forgot password flow
    // Catch errors silently so provisioning still succeeds if email fails
    const inviterName = requestingUser ? `${requestingUser.firstName} ${requestingUser.lastName}`.trim() : undefined;
    this.passwordResetService.forgotPassword(
      { email },
      {
        isProvisioning: true,
        inviterName,
        organizationName: organization?.name || 'KeyMaster Workspace',
      }
    ).catch(err => {
      console.error('Failed to send password setup email for new member:', err);
    });

    return MemberResponseDto.from(orgUser);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    memberId: string,
    organizationId: string,
    dto: UpdateMemberDto,
    requestingUserId: string,
    organization: any,
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepository.findById(memberId, organizationId);
    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }
    return this._performUpdate(member, organizationId, dto, requestingUserId, organization);
  }

  async updateBySlug(
    publicSlug: string,
    organizationId: string,
    dto: UpdateMemberDto,
    requestingUserId: string,
    organization: any,
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepository.findByUserSlug(publicSlug, organizationId);
    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }
    return this._performUpdate(member, organizationId, dto, requestingUserId, organization);
  }

  private async _performUpdate(
    member: any,
    organizationId: string,
    dto: UpdateMemberDto,
    requestingUserId: string,
    organization: any,
  ): Promise<MemberResponseDto> {
    const memberId = member.id;

    // Protect the organization owner from status changes
    if (
      organization.ownerId === member.userId &&
      dto.status !== undefined &&
      dto.status !== UserStatus.ACTIVE
    ) {
      throw new ForbiddenException('The organization owner cannot be suspended or removed.');
    }

    if (dto.roleIds !== undefined) {
      await this.validateRolesInOrg(dto.roleIds, organizationId);
    }

    await this.prisma.$transaction(async (tx) => {
      // Update status
      if (dto.status !== undefined) {
        await tx.organizationUser.update({
          where: { id: memberId },
          data: { status: dto.status },
        });
      }

      // Update user name fields if provided
      if (dto.firstName !== undefined || dto.lastName !== undefined) {
        const updateData: any = {};
        if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
        if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
        await tx.user.update({ where: { id: member.userId }, data: updateData });
      }

      // Sync roles
      if (dto.roleIds !== undefined) {
        await tx.memberRole.deleteMany({ where: { memberId } });
        if (dto.roleIds.length > 0) {
          await tx.memberRole.createMany({
            data: dto.roleIds.map((roleId) => ({ memberId, roleId })),
          });
        }
      }
    });

    // Invalidate permission cache for the affected user
    await this.cacheService.delete(`auth:perms:${organizationId}:${member.userId}`);

    const updated = await this.memberRepository.findById(memberId, organizationId);
    return MemberResponseDto.from(updated);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async remove(
    memberId: string,
    organizationId: string,
    requestingUserId: string,
    organization: any,
  ): Promise<void> {
    const member = await this.memberRepository.findById(memberId, organizationId);
    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }
    await this._performRemove(member, organizationId, requestingUserId, organization);
  }

  async removeBySlug(
    publicSlug: string,
    organizationId: string,
    requestingUserId: string,
    organization: any,
  ): Promise<void> {
    const member = await this.memberRepository.findByUserSlug(publicSlug, organizationId);
    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }
    await this._performRemove(member, organizationId, requestingUserId, organization);
  }

  private async _performRemove(
    member: any,
    organizationId: string,
    requestingUserId: string,
    organization: any,
  ): Promise<void> {
    if (organization.ownerId === member.userId) {
      throw new ForbiddenException('The organization owner cannot be removed.');
    }

    if (member.userId === requestingUserId) {
      throw new BadRequestException('You cannot remove yourself from the organization.');
    }

    await this.memberRepository.remove(member.id, organizationId);
    await this.cacheService.delete(`auth:perms:${organizationId}:${member.userId}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async validateRolesInOrg(roleIds: string[], organizationId: string): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, organizationId },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException(
        'One or more roleIds are invalid or do not belong to this organization.',
      );
    }
  }
}
