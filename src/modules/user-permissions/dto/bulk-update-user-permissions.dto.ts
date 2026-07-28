import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsString, IsUUID, ValidateNested } from 'class-validator';
import { UserPermissionEffect } from '@prisma/client';

export class PermissionOverrideItemDto {
  @IsUUID('4', { message: 'permissionId must be a valid UUID' })
  permissionId: string;

  @IsEnum(UserPermissionEffect, { message: 'effect must be either GRANT or DENY' })
  effect: UserPermissionEffect;
}

export class BulkUpdateUserPermissionsDto {
  @IsArray()
  @ArrayMaxSize(500, { message: 'Maximum 500 permission overrides per request' })
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideItemDto)
  permissions: PermissionOverrideItemDto[];
}
