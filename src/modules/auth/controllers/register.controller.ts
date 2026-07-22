import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Controller('auth')
export class RegisterController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<AuthResponseDto> {
    return this.authService.acceptInvite(dto);
  }
}
