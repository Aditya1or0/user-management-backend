import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RegistrationService } from '../services/registration.service';
import { InvitationService } from '../services/invitation.service';
import { LoginService } from '../services/login.service';
import { PasswordResetService } from '../services/password-reset.service';
import { OtpLoginService } from '../services/otp-login.service';
import { TokenService } from '../services/token.service';
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
import { SessionContext } from '../../../common/types/session-context.interface';

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
  ) {}

  private getSessionContext(req: Request): SessionContext {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    const cookieName = this.configService.get<string>('auth.refreshCookieName') || 'refresh_token';
    const secure = this.configService.get<boolean>('auth.cookieSecure') || false;
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>('auth.cookieSameSite') || 'lax';
    
    // Parse duration from config for cookie maxAge
    const expiresInString = this.configService.get<string>('auth.refreshTokenExpiresIn') || '30d';
    const match = expiresInString.match(/^(\d+)([smhd])$/);
    let maxAge = 30 * 24 * 60 * 60 * 1000;
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case 's': maxAge = value * 1000; break;
        case 'm': maxAge = value * 60 * 1000; break;
        case 'h': maxAge = value * 60 * 60 * 1000; break;
        case 'd': maxAge = value * 24 * 60 * 60 * 1000; break;
      }
    }

    res.cookie(cookieName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/v1/auth',
      maxAge,
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    const cookieName = this.configService.get<string>('auth.refreshCookieName') || 'refresh_token';
    const secure = this.configService.get<boolean>('auth.cookieSecure') || false;
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>('auth.cookieSameSite') || 'lax';

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/v1/auth',
    });
  }

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
    const context = this.getSessionContext(req);
    const result = await this.loginService.login(dto, context);
    
    if (result.refreshToken) {
      this.setRefreshTokenCookie(res, result.refreshToken);
    }

    // Remove refreshToken from response body
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
    const context = this.getSessionContext(req);
    const result = await this.otpLoginService.loginWithOtp(dto, context);
    
    if (result.refreshToken) {
      this.setRefreshTokenCookie(res, result.refreshToken);
    }

    // Remove refreshToken from response body
    const { refreshToken, ...responseDto } = result;
    return responseDto;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.get<string>('auth.refreshCookieName') || 'refresh_token';
    const rawRefreshToken = req.cookies?.[cookieName];

    if (!rawRefreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Refresh token missing.' });
    }

    const context = this.getSessionContext(req);
    const result = await this.tokenService.refreshTokens(rawRefreshToken, context);

    this.setRefreshTokenCookie(res, result.refreshToken);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.get<string>('auth.refreshCookieName') || 'refresh_token';
    const rawRefreshToken = req.cookies?.[cookieName];

    if (rawRefreshToken) {
      await this.tokenService.revokeRefreshToken(rawRefreshToken);
    }

    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.tokenService.revokeAllUserSessions(user.id);
    this.clearRefreshTokenCookie(res);
    return { message: 'All sessions logged out successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return user;
  }
}

