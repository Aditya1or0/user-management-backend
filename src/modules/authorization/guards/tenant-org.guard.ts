import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';

@Injectable()
export class TenantOrgGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required.');
    }

    let orgId = request.headers['x-organization-id'] as string | undefined;

    if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
      // Fallback: look up user's active organizations if header is not passed
      const memberships = await this.prisma.organizationUser.findMany({
        where: { userId: user.id },
        include: { organization: true },
      });

      const activeMemberships = memberships.filter(
        (m) => m.status === UserStatus.ACTIVE && m.organization && !m.organization.deletedAt,
      );

      if (activeMemberships.length === 0) {
        throw new ForbiddenException('User is not a member of any active organization.');
      }

      orgId = activeMemberships[0].organizationId;
    }

    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId.trim(),
          userId: user.id,
        },
      },
      include: {
        organization: true,
        roles: { include: { role: true } },
      },
    });

    if (
      !orgUser ||
      orgUser.status !== UserStatus.ACTIVE ||
      !orgUser.organization ||
      orgUser.organization.deletedAt
    ) {
      throw new ForbiddenException('Access denied to the specified organization context.');
    }

    request.orgId = orgUser.organizationId;
    request.orgUser = orgUser;
    request.organization = orgUser.organization;

    return true;
  }
}
