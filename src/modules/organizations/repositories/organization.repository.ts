import { ConflictException, Injectable } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';
import { generateBaseSlug, formatSequentialSlug } from '../../../common/utils/slug.util';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findById(id: string, tx?: PrismaClientOrTx): Promise<Organization | null> {
    return this.getClient(tx).organization.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string, tx?: PrismaClientOrTx): Promise<Organization | null> {
    return this.getClient(tx).organization.findUnique({
      where: { slug },
    });
  }

  /**
   * Generates an initial candidate unique slug based on read lookups.
   */
  async findAvailableSlug(name: string, tx?: PrismaClientOrTx): Promise<string> {
    const client = this.getClient(tx);
    const baseSlug = generateBaseSlug(name);

    let candidate = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await client.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      counter++;
      candidate = formatSequentialSlug(baseSlug, counter);
    }
  }

  /**
   * Production-grade create method with atomic slug retry handling for race condition safety.
   * If a unique constraint P2002 conflict occurs on slug during insertion, it increments the candidate suffix
   * and retries up to maxRetries attempts.
   */
  async createWithSlugRetry(
    name: string,
    dataWithoutSlug: Omit<Prisma.OrganizationCreateInput, 'slug'>,
    tx?: PrismaClientOrTx,
    maxRetries = 5,
  ): Promise<Organization> {
    const baseSlug = generateBaseSlug(name);
    let initialCandidate = await this.findAvailableSlug(name, tx);
    let counter = 0;

    // Determine current counter offset from initial candidate
    if (initialCandidate !== baseSlug) {
      const match = initialCandidate.match(/-(\d+)$/);
      if (match) {
        counter = parseInt(match[1], 10);
      }
    }

    let candidateSlug = initialCandidate;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.getClient(tx).organization.create({
          data: {
            ...dataWithoutSlug,
            slug: candidateSlug,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          (error.meta.target as string[]).includes('slug')
        ) {
          attempt++;
          counter++;
          candidateSlug = formatSequentialSlug(baseSlug, counter);
          if (attempt >= maxRetries) {
            throw new ConflictException(
              'Failed to assign a unique organization slug due to high concurrent registration volume.',
            );
          }
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to create organization with a unique slug.');
  }

  async create(data: Prisma.OrganizationCreateInput, tx?: PrismaClientOrTx): Promise<Organization> {
    return this.getClient(tx).organization.create({ data });
  }
}
