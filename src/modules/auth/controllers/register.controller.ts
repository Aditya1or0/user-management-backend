import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegistrationService } from '../services/registration.service';
import { InvitationService } from '../services/invitation.service';
import { RegisterDto } from '../dto/register.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Controller('auth')
export class RegisterController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly invitationService: InvitationService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.registrationService.register(dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<AuthResponseDto> {
    return this.invitationService.acceptInvite(dto);
  }
}
