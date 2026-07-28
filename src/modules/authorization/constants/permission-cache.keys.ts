export const permissionCacheKeys = {
  userPermissions: (userId: string, organizationId: string) => `auth:permissions:${organizationId}:${userId}`,
};
