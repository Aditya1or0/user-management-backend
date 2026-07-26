export class PermissionResponseDto {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string | null;
  isActive: boolean;
  usedInRolesCount: number;

  constructor(permission: any) {
    this.id = permission.id;
    this.key = permission.key;
    this.module = permission.module;
    this.action = permission.action;
    this.description = permission.description ?? null;
    this.isActive = permission.isActive ?? true;
    this.usedInRolesCount = permission._count?.roles ?? permission.usedInRolesCount ?? 0;
  }
}
