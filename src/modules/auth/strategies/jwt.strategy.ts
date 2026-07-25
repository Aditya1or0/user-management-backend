import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../users/repositories/user.repository';
import { OrganizationUserRepository } from '../../organizations/repositories/organization-user.repository';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';
import { UserStatus } from '../../../common/enums/user-status.enum';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly organizationUserRepository: OrganizationUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret') || 'aditya-jwt',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }

    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is inactive or has been deleted.');
    }

    const memberships = await this.organizationUserRepository.findUserOrganizations(user.id);
    if (
      memberships.length > 0 &&
      memberships.every((m) => m.status === UserStatus.SUSPENDED)
    ) {
      throw new UnauthorizedException('User account is currently suspended.');
    }

    return {
      id: user.id,
      email: user.email,
    };
  }
}
