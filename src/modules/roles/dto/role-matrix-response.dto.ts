export class PermissionMatrixItemDto {
  id: string;
  key: string;
  action: string;
  description: string | null;
}

export class PermissionMatrixModuleDto {
  module: string;
  permissions: PermissionMatrixItemDto[];
}

export class RoleMatrixResponseDto {
  data: PermissionMatrixModuleDto[];

  constructor(groupedModules: PermissionMatrixModuleDto[]) {
    this.data = groupedModules;
  }
}
