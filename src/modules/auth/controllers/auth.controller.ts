import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { RegistrationService } from '../services/registration.service';
import { InvitationService } from '../services/invitation.service';
import { LoginService } from '../services/login.service';
import { PasswordResetService } from '../services/password-reset.service';
import { OtpLoginService } from '../services/otp-login.service';
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly invitationService: InvitationService,
    private readonly loginService: LoginService,
    private readonly passwordResetService: PasswordResetService,
    private readonly otpLoginService: OtpLoginService,
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.loginService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.passwordResetService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.passwordResetService.resetPasswordWithToken(dto);
  }

  @Post('reset-password-otp')
  @HttpCode(HttpStatus.OK)
  async resetPasswordWithOtp(@Body() dto: ResetPasswordOtpDto): Promise<{ message: string }> {
    return this.passwordResetService.resetPasswordWithOtp(dto);
  }

  @Post('send-login-otp')
  @HttpCode(HttpStatus.OK)
  async sendLoginOtp(@Body() dto: SendLoginOtpDto): Promise<{ message: string }> {
    return this.otpLoginService.sendLoginOtp(dto);
  }

  @Post('login-otp')
  @HttpCode(HttpStatus.OK)
  async loginWithOtp(@Body() dto: LoginOtpDto): Promise<LoginResponseDto> {
    return this.otpLoginService.loginWithOtp(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return user;
  }
}
