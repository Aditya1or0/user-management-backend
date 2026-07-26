import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  ArrayUnique,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMemberDto {
  @IsEmail({}, { message: 'Valid email address is required.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
