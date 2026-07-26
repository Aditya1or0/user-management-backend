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

@Injectable()
export class MembersService {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
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

  // ─── Create (admin provision) ────────────────────────────────────────────────

  async create(
    organizationId: string,
    dto: CreateMemberDto,
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
      `Nimbus!${Math.random().toString(36).slice(2, 10)}`,
      10,
    );

    const orgUser = await this.prisma.$transaction(async (tx) => {
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
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

    if (organization.ownerId === member.userId) {
      throw new ForbiddenException('The organization owner cannot be removed.');
    }

    if (member.userId === requestingUserId) {
      throw new BadRequestException('You cannot remove yourself from the organization.');
    }

    await this.memberRepository.remove(memberId, organizationId);
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
