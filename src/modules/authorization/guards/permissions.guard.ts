import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';
import { PermissionResolutionService } from '../services/permission-resolution.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolutionService: PermissionResolutionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const orgId = request.orgId as string | undefined;

    if (!user || !user.id || !orgId) {
      throw new ForbiddenException('Organization context and authentication required.');
    }

    const userPermissions = await this.permissionResolutionService.getGrantedPermissionKeys(user.id, orgId);

    if (userPermissions.includes('*')) {
      return true;
    }

    const hasAllRequired = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllRequired) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
