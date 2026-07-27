import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { RefreshToken, Prisma } from '@prisma/client';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.RefreshTokenUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<RefreshToken> {
    const client = tx || this.prisma;
    return client.refreshToken.create({ data });
  }

  async findByTokenHash(tokenHash: string, tx?: Prisma.TransactionClient): Promise<RefreshToken | null> {
    const client = tx || this.prisma;
    return client.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revoke(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(sessionId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
