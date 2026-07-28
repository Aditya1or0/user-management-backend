import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { parseDurationToMs } from '../../../common/utils/duration.util';

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  setRefreshTokenCookie(response: Response, refreshToken: string): void {
    const cookieName = this.configService.getOrThrow<string>('auth.refreshCookieName');
    const secure = this.configService.getOrThrow<boolean>('auth.cookieSecure');
    const sameSite = this.configService.getOrThrow<'lax' | 'strict' | 'none'>('auth.cookieSameSite');
    
    const expiresInString = this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn');
    const maxAge = parseDurationToMs(expiresInString);

    response.cookie(cookieName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/v1/auth',
      maxAge,
    });
  }

  clearRefreshTokenCookie(response: Response): void {
    const cookieName = this.configService.getOrThrow<string>('auth.refreshCookieName');
    const secure = this.configService.getOrThrow<boolean>('auth.cookieSecure');
    const sameSite = this.configService.getOrThrow<'lax' | 'strict' | 'none'>('auth.cookieSameSite');

    response.clearCookie(cookieName, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/v1/auth',
    });
  }
}
