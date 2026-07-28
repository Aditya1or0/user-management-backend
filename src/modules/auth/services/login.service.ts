import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuditAction } from '../../../common/enums/audit-action.enum';
import { AuditEntity } from '../../../common/enums/audit-entity.enum';
import { SessionContext } from '../../../common/types/session-context.interface';
import { PermissionResolutionService } from '../../authorization/services/permission-resolution.service';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationUserRepository: OrganizationUserRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly permissionResolutionService: PermissionResolutionService,
  ) {}

  async login(dto: LoginDto, context: SessionContext): Promise<LoginResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Find user by email
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 2. Verify password using PasswordService / bcrypt
    const isPasswordValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 3. Account status checks (inactive, deleted)
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 4. Check OrganizationUser membership status (suspended)
    const memberships = await this.organizationUserRepository.findUserOrganizations(user.id);
    if (
      memberships.length > 0 &&
      memberships.every((m) => m.status === UserStatus.SUSPENDED)
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const activeOrganizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      status: m.organization.status,
    }));

    const organizationId = activeOrganizations.length > 0 ? activeOrganizations[0].id : undefined;

    // 5. Generate Session and Tokens via TokenService
    const { accessToken, refreshToken } = await this.tokenService.createSessionTokens(user, context);

    // 6. Record Audit Log
    await this.auditService.record({
      userId: user.id,
      action: AuditAction.USER_LOGGED_IN,
      entity: AuditEntity.USER,
      entityId: user.id,
      newValue: { email: user.email, loggedInAt: new Date() },
    });

    // Fetch permissions and roles if organizationId is available
    let permissions: string[] = [];
    let roles: string[] = [];
    if (organizationId) {
      permissions = await this.permissionResolutionService.getGrantedPermissionKeys(user.id, organizationId);
      
      const member = await this.organizationUserRepository.findByUserAndOrganization(user.id, organizationId);
      if (member && member.roles) {
        roles = member.roles.map(r => r.role.key || r.role.name);
      }
    }

    // 7. Format clean DTO response
    return {
      accessToken,
      refreshToken, // Not sent in JSON usually, but kept in DTO internally so controller can access it for cookie
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || undefined,
        isActive: user.isActive,
        createdAt: user.createdAt,
        roles,
        permissions,
      },
      organizations: activeOrganizations,
    };
  }
}

