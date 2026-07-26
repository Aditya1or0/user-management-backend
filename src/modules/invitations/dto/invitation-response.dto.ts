export class InvitationResponseDto {
  id: string;
  organizationId: string;
  email: string;
  invitedById: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
