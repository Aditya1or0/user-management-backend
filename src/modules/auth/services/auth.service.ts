import { Injectable } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { InvitationService } from './invitation.service';
import { LoginService } from './login.service';
import { RegisterDto } from '../dto/register.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginResponseDto } from '../dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly invitationService: InvitationService,
    private readonly loginService: LoginService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    return this.registrationService.register(dto);
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<AuthResponseDto> {
    return this.invitationService.acceptInvite(dto);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    return this.loginService.login(dto);
  }
}
