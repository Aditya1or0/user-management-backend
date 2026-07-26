export class RoleResponseDto {
  id: string;
  name: string;
  key: string | null;
  description: string | null;
  isSystem: boolean;
  assignedUsersCount: number;
  permissionsCount: number;
  permissionsPreview: string[];
  permissionIds: string[];
  permissions?: {
    id: string;
    key: string;
    module: string;
    action: string;
    description: string | null;
  }[];
  createdAt?: string;
  updatedAt?: string;

  constructor(role: any) {
    this.id = role.id;
    this.name = role.name;
    this.key = role.key ?? null;
    this.description = role.description ?? null;
    this.isSystem = role.isSystem ?? false;
    this.assignedUsersCount = role._count?.members ?? role.assignedUsersCount ?? 0;
    this.permissionsCount = role._count?.permissions ?? role.permissionsCount ?? (role.permissions?.length || 0);

    // Extract permission preview keys
    if (Array.isArray(role.permissions)) {
      this.permissionsPreview = role.permissions
        .map((rp: any) => (rp.permission ? rp.permission.key : rp.key || ''))
        .filter(Boolean);
      
      this.permissionIds = role.permissions
        .map((rp: any) => (rp.permissionId ? rp.permissionId : rp.id || ''))
        .filter(Boolean);

      this.permissions = role.permissions
        .filter((rp: any) => rp.permission)
        .map((rp: any) => ({
          id: rp.permission.id,
          key: rp.permission.key,
          module: rp.permission.module,
          action: rp.permission.action,
          description: rp.permission.description ?? null,
        }));
    } else {
      this.permissionsPreview = role.permissionsPreview || [];
      this.permissionIds = role.permissionIds || [];
    }

    if (role.createdAt) {
      this.createdAt = new Date(role.createdAt).toISOString();
    }
    if (role.updatedAt) {
      this.updatedAt = new Date(role.updatedAt).toISOString();
    }
  }
}
