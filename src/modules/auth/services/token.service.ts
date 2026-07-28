import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/database.service';
import { SessionRepository } from '../repositories/session.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { SessionContext } from '../../../common/types/session-context.interface';
import { User } from '@prisma/client';
import { parseDurationToMs } from '../../../common/utils/duration.util';

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

  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateAccessToken(user: Pick<User, 'id' | 'email'>): Promise<string> {
    const expiresIn = this.configService.getOrThrow<string>('auth.jwtAccessTokenExpiresIn');
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: expiresIn as any }
    );
  }

  async createSessionTokens(user: Pick<User, 'id' | 'email'>, context: SessionContext): Promise<TokenPair> {
    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    
    const expiresInString = this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn');
    const expiresAt = new Date(Date.now() + parseDurationToMs(expiresInString));

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create Session (no longer using organizationId)
      const session = await this.sessionRepository.create(
        {
          userId: user.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          expiresAt, 
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
      const accessToken = await this.generateAccessToken(user);

      return { accessToken, refreshToken: rawRefreshToken };
    });
  }

  async refreshTokens(rawRefreshToken: string, context: SessionContext): Promise<TokenPair> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

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

      // Revoke the OLD token (Token Rotation) with concurrency safety
      const isRevoked = await this.refreshTokenRepository.revokeIfActive(storedToken.id, tx);
      if (!isRevoked) {
        this.logger.warn(`Concurrency clash or reuse detected for session ${session.id}! Revoking entire family.`);
        await this.refreshTokenRepository.revokeFamily(session.id, tx);
        await this.sessionRepository.revoke(session.id, tx);
        throw new UnauthorizedException('Invalid or expired refresh token.');
      }

      // Generate NEW refresh token
      const newRawRefreshToken = this.generateRefreshToken();
      const newTokenHash = this.hashRefreshToken(newRawRefreshToken);
      
      const expiresInString = this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn');
      const expiresAt = new Date(Date.now() + parseDurationToMs(expiresInString));

      await this.refreshTokenRepository.create(
        {
          userId: storedToken.userId,
          sessionId: storedToken.sessionId,
          tokenHash: newTokenHash,
          expiresAt,
        },
        tx
      );

      const user = await tx.user.findUnique({ where: { id: storedToken.userId } });
      if (!user || !user.isActive || user.deletedAt) {
         throw new UnauthorizedException('User account is not active.');
      }

      const accessToken = await this.generateAccessToken(user);

      return { accessToken, refreshToken: newRawRefreshToken };
    });
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    
    await this.prisma.$transaction(async (tx) => {
      const storedToken = await this.refreshTokenRepository.findByTokenHash(tokenHash, tx);
      if (storedToken && !storedToken.revokedAt) {
        await this.refreshTokenRepository.revokeIfActive(storedToken.id, tx);
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
