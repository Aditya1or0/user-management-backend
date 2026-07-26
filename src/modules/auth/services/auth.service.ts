import { Injectable } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { InvitationService } from './invitation.service';
import { LoginService } from './login.service';
import { PasswordResetService } from './password-reset.service';
import { OtpLoginService } from './otp-login.service';
import { RegisterDto } from '../dto/register.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ResetPasswordOtpDto } from '../dto/reset-password-otp.dto';
import { SendLoginOtpDto } from '../dto/send-login-otp.dto';
import { LoginOtpDto } from '../dto/login-otp.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginResponseDto } from '../dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly invitationService: InvitationService,
    private readonly loginService: LoginService,
    private readonly passwordResetService: PasswordResetService,
    private readonly otpLoginService: OtpLoginService,
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.passwordResetService.forgotPassword(dto);
  }

  async resetPasswordWithToken(dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.passwordResetService.resetPasswordWithToken(dto);
  }

  async resetPasswordWithOtp(dto: ResetPasswordOtpDto): Promise<{ message: string }> {
    return this.passwordResetService.resetPasswordWithOtp(dto);
  }

  async sendLoginOtp(dto: SendLoginOtpDto): Promise<{ message: string }> {
    return this.otpLoginService.sendLoginOtp(dto);
  }

  async loginWithOtp(dto: LoginOtpDto): Promise<LoginResponseDto> {
    return this.otpLoginService.loginWithOtp(dto);
  }
}
