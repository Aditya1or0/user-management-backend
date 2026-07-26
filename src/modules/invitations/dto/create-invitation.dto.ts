import { IsEmail, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateInvitationDto {
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsUUID()
  @IsNotEmpty()
  organizationId: string;
}
