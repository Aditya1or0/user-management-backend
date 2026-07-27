import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { generatePublicSlug } from '../../../common/utils/slug.util';

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
    const slugName = `${data.firstName} ${data.lastName}`;
    const publicSlug = data.publicSlug || generatePublicSlug(slugName);
    
    return this.getClient(tx).user.create({
      data: {
        ...data,
        publicSlug,
        email: data.email.trim().toLowerCase(),
      },
    });
  }
}
