import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

@Injectable()
export class UserRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findByEmail(email: string, tx?: PrismaClientOrTx): Promise<User | null> {
    return this.getClient(tx).user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findById(id: string, tx?: PrismaClientOrTx): Promise<User | null> {
    return this.getClient(tx).user.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.UserCreateInput, tx?: PrismaClientOrTx): Promise<User> {
    return this.getClient(tx).user.create({
      data: {
        ...data,
        email: data.email.trim().toLowerCase(),
      },
    });
  }
}
