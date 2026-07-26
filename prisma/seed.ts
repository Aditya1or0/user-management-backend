import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  { module: 'users', action: 'read', key: 'users:read', description: 'View user directory and profiles' },
  { module: 'users', action: 'create', key: 'users:create', description: 'Invite or provision new users' },
  { module: 'users', action: 'update', key: 'users:update', description: 'Modify user details, status, or roles' },
  { module: 'users', action: 'delete', key: 'users:delete', description: 'Soft-delete or purge user accounts' },
  { module: 'roles', action: 'read', key: 'roles:read', description: 'View role templates and assigned permissions' },
  { module: 'roles', action: 'create', key: 'roles:create', description: 'Design new custom role templates' },
  { module: 'roles', action: 'update', key: 'roles:update', description: 'Edit existing role permissions' },
  { module: 'roles', action: 'delete', key: 'roles:delete', description: 'Remove custom role templates' },
  { module: 'permissions', action: 'read', key: 'permissions:read', description: 'Inspect available system action keys' },
  { module: 'permissions', action: 'create', key: 'permissions:create', description: 'Register new action keys' },
  { module: 'reports', action: 'read', key: 'reports:read', description: 'View security audit trails and log metrics' },
];

async function main() {
  console.log('Seeding default permissions...');

  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
        isActive: true,
      },
      create: {
        module: perm.module,
        action: perm.action,
        key: perm.key,
        description: perm.description,
        isActive: true,
      },
    });
  }

  console.log('Default permissions seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
