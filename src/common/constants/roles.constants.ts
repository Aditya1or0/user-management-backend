import { SystemRole } from '../enums/system-role.enum';

export interface SystemRoleDefinition {
  key: SystemRole;
  name: string;
  description: string;
}

export const SYSTEM_ROLE_DEFINITIONS: Record<SystemRole, SystemRoleDefinition> = {
  [SystemRole.OWNER]: {
    key: SystemRole.OWNER,
    name: 'Owner',
    description: 'Full administrative access to organization',
  },
  [SystemRole.ADMIN]: {
    key: SystemRole.ADMIN,
    name: 'Admin',
    description: 'Administrative access to manage workspace and members',
  },
  [SystemRole.MEMBER]: {
    key: SystemRole.MEMBER,
    name: 'Member',
    description: 'Standard member access to organization resources',
  },
};
