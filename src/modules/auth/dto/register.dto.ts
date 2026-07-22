import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email: string;

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

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Matches(/^[\p{L}\p{M}\p{N}\s&.'-]+$/u, {
    message: 'Organization name contains invalid characters',
  })
  organizationName: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s()-]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone?: string;
}
