import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/database.service';

export type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;
