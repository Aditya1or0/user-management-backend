import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/database.service';
import { RegisterDto } from '../dto/register.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { generateSlug } from '../../../common/utils/slug.util';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    
    // Generate a unique slug, fallback will be handled by the util adding entropy
    const slug = generateSlug(dto.organizationName);

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        // 1. Create the User
        const user = await prisma.user.create({
          data: {
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
          },
        });

        // 2. Create the Organization
        const organization = await prisma.organization.create({
          data: {
            name: dto.organizationName,
            slug,
            ownerId: user.id,
          },
        });

        // 3. Create OrganizationUser (Membership)
        const orgUser = await prisma.organizationUser.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            email: user.email,
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });

        // 4. Provision a default 'Owner' Role if it doesn't exist yet for this org
        const role = await prisma.role.create({
          data: {
            organizationId: organization.id,
            name: 'Owner',
            description: 'Full administrative access',
            isSystem: true,
          },
        });

        // 5. Assign the Role to the Member
        await prisma.memberRole.create({
          data: {
            memberId: orgUser.id,
            roleId: role.id,
          },
        });

        // 6. Record Audit Log
        await prisma.auditLog.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            action: 'USER_REGISTERED',
            entity: 'Organization',
            entityId: organization.id,
          },
        });

        return { user, organization };
      });

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
    } catch (error) {
      // Handle slug collision or other DB errors gracefully
      if (error?.code === 'P2002') {
         throw new ConflictException('A conflict occurred during registration.');
      }
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<AuthResponseDto> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: dto.token }, // Assuming token is directly matching tokenHash for this boilerplate
      include: { organization: true },
    });

    if (!invitation || invitation.revokedAt) {
      throw new NotFoundException('Invitation not found or revoked');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation already accepted');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        // 1. Create the User
        const user = await prisma.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        });

        // 2. Mark Invitation as Accepted
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        // 3. Create OrganizationUser (Membership)
        await prisma.organizationUser.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            email: user.email,
            status: 'ACTIVE',
            joinedAt: new Date(),
            invitedBy: invitation.invitedById, // May be null but valid in schema
          },
        });

        // 4. Record Audit Log
        await prisma.auditLog.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            action: 'INVITATION_ACCEPTED',
            entity: 'User',
            entityId: user.id,
          },
        });

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
    } catch (error) {
      throw new InternalServerErrorException('Failed to accept invitation');
    }
  }
}
