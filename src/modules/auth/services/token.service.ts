import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/database.service';
import { SessionRepository } from '../repositories/session.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { SessionContext } from '../../../common/types/session-context.interface';
import { User } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessionRepository: SessionRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  /**
   * Helper to parse '30d', '15m' etc into milliseconds
   */
  private parseExpiration(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSessionTokens(user: Pick<User, 'id' | 'email'>, context: SessionContext, organizationId?: string): Promise<TokenPair> {
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    
    const expiresInString = this.configService.get<string>('auth.refreshTokenExpiresIn') || '30d';
    const expiresAt = new Date(Date.now() + this.parseExpiration(expiresInString));

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create Session
      const session = await this.sessionRepository.create(
        {
          userId: user.id,
          // Require organizationId for backwards compatibility in schema (it's required in schema, though maybe we can pass empty or user's default).
          // We must ensure the caller passes organizationId, or we use a dummy one if schema allows (it doesn't, it's string).
          organizationId: organizationId || 'system-session', 
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          expiresAt, // session expires with the initial refresh token
        },
        tx
      );

      // 2. Create Refresh Token
      await this.refreshTokenRepository.create(
        {
          userId: user.id,
          sessionId: session.id,
          tokenHash,
          expiresAt,
        },
        tx
      );

      // 3. Generate Access Token
      const accessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { expiresIn: (this.configService.get<string>('auth.jwtAccessTokenExpiresIn') || '15m') as any }
      );

      return { accessToken, refreshToken: rawRefreshToken };
    });
  }

  async refreshTokens(rawRefreshToken: string, context: SessionContext): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);

    return await this.prisma.$transaction(async (tx) => {
      const storedToken = await this.refreshTokenRepository.findByTokenHash(tokenHash, tx);

      if (!storedToken) {
        this.logger.warn(`Attempted to refresh with unknown token hash`);
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      const session = await this.sessionRepository.findById(storedToken.sessionId, tx);
      if (!session || session.status !== 'ACTIVE') {
        throw new UnauthorizedException('Session is no longer active.');
      }

      // Check for token reuse (if token is already revoked)
      if (storedToken.revokedAt) {
        this.logger.warn(`Refresh token reuse detected for session ${session.id}! Revoking entire family.`);
        await this.refreshTokenRepository.revokeFamily(session.id, tx);
        await this.sessionRepository.revoke(session.id, tx);
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      // Check expiration
      if (storedToken.expiresAt < new Date()) {
        await this.refreshTokenRepository.revoke(storedToken.id, tx);
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      // Revoke the OLD token (Token Rotation)
      await this.refreshTokenRepository.revoke(storedToken.id, tx);

      // Generate NEW refresh token
      const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
      const newTokenHash = this.hashToken(newRawRefreshToken);
      
      const expiresInString = this.configService.get<string>('auth.refreshTokenExpiresIn') || '30d';
      const expiresAt = new Date(Date.now() + this.parseExpiration(expiresInString));

      await this.refreshTokenRepository.create(
        {
          userId: storedToken.userId,
          sessionId: storedToken.sessionId,
          tokenHash: newTokenHash,
          expiresAt,
        },
        tx
      );

      // We need user email for the JWT. Let's fetch the user.
      const user = await tx.user.findUnique({ where: { id: storedToken.userId } });
      if (!user || !user.isActive || user.deletedAt) {
         throw new UnauthorizedException('User account is not active.');
      }

      const accessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { expiresIn: (this.configService.get<string>('auth.jwtAccessTokenExpiresIn') || '15m') as any }
      );

      return { accessToken, refreshToken: newRawRefreshToken };
    });
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    
    await this.prisma.$transaction(async (tx) => {
      const storedToken = await this.refreshTokenRepository.findByTokenHash(tokenHash, tx);
      if (storedToken && !storedToken.revokedAt) {
        await this.refreshTokenRepository.revoke(storedToken.id, tx);
        await this.sessionRepository.revoke(storedToken.sessionId, tx);
      }
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.refreshTokenRepository.revokeAllForUser(userId, tx);
      await this.sessionRepository.revokeAllForUser(userId, tx);
    });
  }
}
