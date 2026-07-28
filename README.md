# Multi-Tenant SaaS Management Engine

A production-grade, highly scalable multi-tenant SaaS backend architecture built with NestJS, Prisma, PostgreSQL, Redis, and BullMQ.

---

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) & [Prisma ORM](https://www.prisma.io/)
- **Background Jobs & Queues**: [BullMQ](https://docs.bullmq.io/) & [Redis](https://redis.io/)
- **Authentication & Security**: Bcrypt, Passport JWT
- **Testing**: Jest & Supertest

---

## 🏗 Multi-Tenant Architecture Overview

This application implements a robust **row-level multi-tenant membership pattern**. A single user identity can belong to multiple distinct tenant organizations with different roles and permissions in each workspace.

```mermaid
graph TD
    Client[HTTP Client] --> Controller[RegisterController]
    Controller --> RegistrationSvc[RegistrationService]
    RegistrationSvc --> PasswordSvc[PasswordService]
    RegistrationSvc --> OrganizationRepo[OrganizationRepository]
    RegistrationSvc --> UserRepo[UserRepository]
    RegistrationSvc --> OrgUserRepo[OrganizationUserRepository]
    RegistrationSvc --> RoleProvisioningSvc[RoleProvisioningService]
    RegistrationSvc --> AuditSvc[AuditService]
    
    OrganizationRepo --> Database[(PostgreSQL Database)]
    UserRepo --> Database
    OrgUserRepo --> Database
    RoleProvisioningSvc --> Database
    AuditSvc --> Database

    RegistrationSvc -. Post-Commit Async Job .-> MailQueueSvc[MailQueueService]
    MailQueueSvc --> BullMQ[BullMQ Redis Queue]
    BullMQ --> MailWorker[MailProcessor Worker]
    MailWorker --> EmailProvider[Console / SMTP Email Provider]
    MailWorker -. Record Sent Audit .-> AuditSvc
```

### Domain Relationship Model

```
User (Global Identity)
  ↓ 1:N
OrganizationUser / Membership (Tenant-Scoped Member)
  ↓ N:1
Organization (Tenant Workspace)
  ↓ 1:N
Roles & MemberRoles (Tenant-Scoped Roles)
```

- **User**: Represents global identity (email, password hash, profile settings).
- **Organization**: Represents an isolated tenant workspace.
- **OrganizationUser**: Junction entity holding tenant-scoped membership state (`status`, `joinedAt`, `invitedBy`).
- **Role**: Defined per-organization (`isSystem: true`, `key: OWNER | ADMIN | MEMBER`).
- **MemberRole**: Connects an `OrganizationUser` membership to a specific `Role` in that organization.

---

## 📁 Repository Folder Structure

```
src/
├── config/                             # Typed Application Configuration
│   ├── app.config.ts                   # Port, ENV, Frontend/API URLs
│   ├── auth.config.ts                  # Salt rounds, JWT secrets
│   ├── database.config.ts              # PostgreSQL connection URL
│   ├── mail.config.ts                  # SMTP & provider settings
│   └── redis.config.ts                 # Redis host, port, credentials
│
├── common/                             # Shared Constants, Enums, Utilities
│   ├── constants/
│   │   ├── queue.constants.ts          # Queue names (mail-queue)
│   │   └── roles.constants.ts          # System role definitions
│   ├── enums/
│   │   ├── audit-action.enum.ts        # USER_REGISTERED, EMAIL_QUEUED, etc.
│   │   ├── audit-entity.enum.ts        # Organization, User, Email, etc.
│   │   ├── system-role.enum.ts         # OWNER, ADMIN, MEMBER
│   │   ├── user-status.enum.ts         # ACTIVE, INVITED, SUSPENDED
│   │   └── organization-status.enum.ts # ACTIVE, SUSPENDED, DELETED
│   ├── types/
│   │   └── prisma.type.ts              # PrismaClientOrTx transaction type
│   └── utils/
│       └── slug.util.ts                # Base & sequential slug generator
│
├── mail/                               # Background Mail Subsystem
│   ├── mail.module.ts                  # BullMQ & Mail Provider registration
│   ├── mail-queue.service.ts           # Async mail job producer
│   ├── mail.processor.ts               # BullMQ worker consumer
│   └── providers/
│       ├── email-provider.interface.ts # Decoupled Email Provider interface
│       └── console-email.provider.ts   # Development console provider
│
├── modules/                            # Domain Feature Modules
│   ├── audit/                          # Audit Logging Module
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   └── repositories/audit-log.repository.ts
│   ├── auth/                           # Authentication Module
│   │   ├── auth.module.ts
│   │   ├── controllers/register.controller.ts
│   │   ├── dto/
│   │   └── services/
│   │       ├── auth.service.ts         # Backward-compatible facade
│   │       ├── registration.service.ts # Registration use-case orchestrator
│   │       ├── invitation.service.ts   # Invitation acceptance orchestrator
│   │       └── password.service.ts     # Bcrypt password hashing
│   ├── invitations/
│   │   └── repositories/invitation.repository.ts
│   ├── organizations/
│   │   ├── services/role-provisioning.service.ts
│   │   └── repositories/
│   │       ├── organization.repository.ts
│   │       └── organization-user.repository.ts
│   ├── roles/
│   │   └── repositories/role.repository.ts
│   └── users/
│       └── repositories/user.repository.ts
```

---

## ⚡ Key Features

1. **Transaction-Safe Registration Flow**:
   - Checks for existing user identity.
   - Hashes password securely using `PasswordService`.
   - Generates a unique sequential slug (e.g. `acme-corporation`, `acme-corporation-1`, `acme-corporation-2`).
   - Executes atomic database transaction creating User, Organization, Membership, System OWNER role, and Audit Log.
   - Enqueues welcome email asynchronously AFTER successful transaction commit.
2. **Sequential Slug Resolution**:
   - `Acme Corporation` → `acme-corporation`
   - Second `Acme Corporation` → `acme-corporation-1`
   - Third `Acme Corporation` → `acme-corporation-2`
3. **Decoupled Background Job Mail Architecture**:
   - Registration and invitation requests return immediately without waiting for external email providers.
   - BullMQ & Redis handle background retries with exponential backoff.
4. **Production-Ready Audit Logging**:
   - Audit logs are recorded for all actions: `USER_REGISTERED`, `INVITATION_ACCEPTED`, `EMAIL_QUEUED`, `EMAIL_SENT`, and `EMAIL_FAILED`.

---

## 🚀 Setup & Installation Instructions

### 1. Prerequisites
- Node.js `v18+` or `v20+`
- PostgreSQL `v14+`
- Redis `v6+`

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3000/api

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/usermanagement?schema=public"

# Redis & BullMQ Queue
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Auth & Cryptography
BCRYPT_SALT_ROUNDS=12
JWT_SECRET=super-secret-production-key
JWT_EXPIRES_IN=1d

# Mail Settings
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USER=
MAIL_PASS=
MAIL_FROM=noreply@saasapp.com
```

### 3. Database Migration
Generate and apply Prisma migrations:

```bash
npx prisma migrate dev --name init_multi_tenant_auth
npx prisma generate
```

### 4. Running the Application

```bash
# Development mode
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

---

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Test coverage report
npm run test:cov
```

---

## 📡 API Endpoints

All API endpoints are documented interactively via Swagger UI. Once the application is running, navigate to:

```
http://localhost:3000/api/docs
```

This Swagger documentation provides a detailed layout of all available resources, request/response models, and allows you to test endpoints directly.

---

## 📄 License
UNLICENSED - Internal SaaS Core.
