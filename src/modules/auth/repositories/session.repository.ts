import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { Session, SessionStatus, Prisma } from '@prisma/client';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SessionUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Session> {
    const client = tx || this.prisma;
    return client.session.create({ data });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Session | null> {
    const client = tx || this.prisma;
    return client.session.findUnique({ where: { id } });
  }

  async revoke(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.session.update({
      where: { id },
      data: { status: SessionStatus.REVOKED },
    });
  }

  async revokeAllForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.session.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED },
    });
  }
}
