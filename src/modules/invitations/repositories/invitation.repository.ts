import { ConflictException, Injectable } from '@nestjs/common';
import { Invitation, Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/database.service';
import { PrismaClientOrTx } from '../../../common/types/prisma.type';

export type InvitationWithOrganization = Invitation & { organization: Organization };

@Injectable()
export class InvitationRepository {
  constructor(private readonly defaultPrisma: PrismaService) {}

  private getClient(tx?: PrismaClientOrTx): PrismaClientOrTx {
    return tx || this.defaultPrisma;
  }

  async findById(
    id: string,
    tx?: PrismaClientOrTx,
  ): Promise<InvitationWithOrganization | null> {
    return this.getClient(tx).invitation.findUnique({
      where: { id },
      include: { organization: true },
    });
  }

  async findByTokenHash(
    tokenHash: string,
    tx?: PrismaClientOrTx,
  ): Promise<InvitationWithOrganization | null> {
    return this.getClient(tx).invitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });
  }

  /**
   * Finds an active (unexpired, unaccepted, unrevoked) invitation for an email in an organization.
   */
  async findActiveInvitation(
    organizationId: string,
    email: string,
    tx?: PrismaClientOrTx,
  ): Promise<Invitation | null> {
    return this.getClient(tx).invitation.findFirst({
      where: {
        organizationId,
        email: email.trim().toLowerCase(),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Marks an invitation as revoked by setting revokedAt = new Date().
   */
  async revoke(id: string, tx?: PrismaClientOrTx): Promise<Invitation> {
    return this.getClient(tx).invitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Atomically marks an invitation as accepted only if it has not already been accepted or revoked.
   * Eliminates concurrent double-acceptance race conditions.
   */
  async markAsAcceptedAtomic(id: string, tx?: PrismaClientOrTx): Promise<void> {
    const result = await this.getClient(tx).invitation.updateMany({
      where: {
        id,
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        acceptedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Invitation has already been accepted or revoked.');
    }
  }

  async markAsAccepted(id: string, tx?: PrismaClientOrTx): Promise<Invitation> {
    return this.getClient(tx).invitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
  }

  async create(
    data: Prisma.InvitationCreateInput,
    tx?: PrismaClientOrTx,
  ): Promise<Invitation> {
    return this.getClient(tx).invitation.create({ data });
  }
}
