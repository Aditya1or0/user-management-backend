import { Injectable } from '@nestjs/common';
import { PasswordResetToken, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async create(
    data: Prisma.PasswordResetTokenCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<PasswordResetToken> {
    return this.getClient(tx).passwordResetToken.create({ data });
  }

  async findByTokenHash(
    tokenHash: string,
    tx?: PrismaClientOrTx,
  ): Promise<PasswordResetToken | null> {
    return this.getClient(tx).passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  async findByOtpHash(
    userId: string,
    otpHash: string,
    tx?: PrismaClientOrTx,
  ): Promise<PasswordResetToken | null> {
    return this.getClient(tx).passwordResetToken.findFirst({
      where: {
        userId,
        otpHash,
      },
    });
  }

  async markAsUsed(id: string, tx?: PrismaClientOrTx): Promise<PasswordResetToken> {
    return this.getClient(tx).passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
