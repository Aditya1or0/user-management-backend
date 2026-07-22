import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message:
      'First name can only contain letters, spaces, hyphens, and apostrophes',
  })
  firstName: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message:
      'Last name can only contain letters, spaces, hyphens, and apostrophes',
  })
  lastName: string;
}
