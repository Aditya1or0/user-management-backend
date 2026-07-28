import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginOtpDto } from '../dto/login-otp.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordOtpDto } from '../dto/reset-password-otp.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SendLoginOtpDto } from '../dto/send-login-otp.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InvitationService } from '../services/invitation.service';
import { LoginService } from '../services/login.service';
import { OtpLoginService } from '../services/otp-login.service';
import { PasswordResetService } from '../services/password-reset.service';
import { RegistrationService } from '../services/registration.service';
import { TokenService } from '../services/token.service';
import { AuthCookieService } from '../services/auth-cookie.service';
import { createSessionContext } from '../../../common/utils/session-context.util';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly invitationService: InvitationService,
    private readonly loginService: LoginService,
    private readonly passwordResetService: PasswordResetService,
    private readonly otpLoginService: OtpLoginService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly authCookieService: AuthCookieService,
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
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: LoginDto) {
    const context = createSessionContext(req);
    const result = await this.loginService.login(dto, context);
    
    if (result.refreshToken) {
      this.authCookieService.setRefreshTokenCookie(res, result.refreshToken);
    }

    const { refreshToken, ...responseDto } = result;
    return responseDto;
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
  async loginWithOtp(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: LoginOtpDto) {
    const context = createSessionContext(req);
    const result = await this.otpLoginService.loginWithOtp(dto, context);
    
    if (result.refreshToken) {
      this.authCookieService.setRefreshTokenCookie(res, result.refreshToken);
    }

    const { refreshToken, ...responseDto } = result;
    return responseDto;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.getOrThrow<string>('auth.refreshCookieName');
    const rawRefreshToken = req.cookies?.[cookieName];

    if (!rawRefreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Refresh token missing.' });
    }

    const context = createSessionContext(req);
    const result = await this.tokenService.refreshTokens(rawRefreshToken, context);

    this.authCookieService.setRefreshTokenCookie(res, result.refreshToken);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.getOrThrow<string>('auth.refreshCookieName');
    const rawRefreshToken = req.cookies?.[cookieName];

    if (rawRefreshToken) {
      await this.tokenService.revokeRefreshToken(rawRefreshToken);
    }

    this.authCookieService.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.tokenService.revokeAllUserSessions(user.id);
    this.authCookieService.clearRefreshTokenCookie(res);
    return { message: 'All sessions logged out successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return user;
  }
}

