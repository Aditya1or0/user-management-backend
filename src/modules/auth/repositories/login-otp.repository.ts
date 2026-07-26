import { Injectable } from '@nestjs/common';
import { LoginOtp, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

@Injectable()
export class LoginOtpRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async create(
    data: Prisma.LoginOtpCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<LoginOtp> {
    return this.getClient(tx).loginOtp.create({ data });
  }

  async findByOtpHash(
    userId: string,
    otpHash: string,
    tx?: PrismaClientOrTx,
  ): Promise<LoginOtp | null> {
    return this.getClient(tx).loginOtp.findFirst({
      where: {
        userId,
        otpHash,
      },
    });
  }

  async markAsUsed(id: string, tx?: PrismaClientOrTx): Promise<LoginOtp> {
    return this.getClient(tx).loginOtp.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
