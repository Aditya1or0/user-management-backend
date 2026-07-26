import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ArrayUnique,
  IsUUID,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(UserStatus, {
    message: `status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  status?: UserStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
