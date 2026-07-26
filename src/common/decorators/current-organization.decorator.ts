import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the Organization object set by TenantOrgGuard on req.organization.
 */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.organization;
  },
);
