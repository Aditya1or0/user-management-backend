export const permissionCacheKeys = {
  userPermissions: (userId: string, organizationId: string) => `auth:permissions:${organizationId}:${userId}`,
  userPermissionsPattern: () => 'auth:permissions:*',
  permissionMeta: () => 'auth:permissions:meta',
};

