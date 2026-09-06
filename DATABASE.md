# Database Schema

## Overview

- **Database**: PostgreSQL
- **ORM**: Prisma 7 with `@prisma/adapter-pg`
- **Schema Style**: Multi-file (`prisma/schema/*.prisma`)
- **ID Strategy**: UUID (`@default(uuid())`)
- **Total Models**: 13
- **Total Enums**: 11

---

## Enums

| Enum | Values |
|------|--------|
| `AuthProvider` | `CREDENTIAL`, `GOOGLE` |
| `UserStatus` | `ACTIVE`, `BLOCKED`, `DELETED` |
| `SalaryType` | `MONTHLY`, `HOURLY` |
| `EmployeeStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `TERMINATED` |
| `ProjectStatus` | `PLANNED`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `REJECTED`, `COMPLETED` |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `SubmissionStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `PayrollStatus` | `DRAFT`, `GENERATED`, `APPROVED`, `PROCESSING`, `PAID`, `REJECTED` |
| `PaymentGateway` | `STRIPE`, `SSLCOMMERZ`, `BKASH` |
| `PaymentStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED` |

---

## Models

### Organization

Multi-tenant root entity. All other models are scoped to an organization.

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `name` | String | |
| `slug` | String | `@unique` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Relations**: users[], roles[], departments[], employees[], projects[], payrolls[], payments[], auditLogs[]

---

### User

Central user record. Links to organization, role, and optionally an employee profile.

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `name` | String | |
| `email` | String | `@unique` |
| `password` | String? | Nullable for Google OAuth users |
| `avatar` | String? | Cloudinary URL |
| `googleId` | String? | `@unique` |
| `authProvider` | AuthProvider | `@default(CREDENTIAL)` |
| `emailVerified` | Boolean | `@default(false)` |
| `roleId` | String | FK → Role |
| `status` | UserStatus | `@default(ACTIVE)` |
| `isActive` | Boolean | `@default(true)` |
| `isDeleted` | Boolean | `@default(false)` |
| `mustChangePassword` | Boolean | `@default(false)` |
| `tokenVersion` | Int | `@default(0)` — incremented on password change |
| `deletedAt` | DateTime? | |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Relations**: role, organization, employee?, auditLogs[]
**Indexes**: `@@unique([email])`, `@@index([organizationId])`, `@@index([roleId])`

---

### Role

System roles (ADMIN, HR_MANAGER, FINANCE_MANAGER, EMPLOYEE) are templates with `isSystem: true, organizationId: null`. When an organization is registered, system roles are copied with the organization's ID.

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `name` | String | |
| `description` | String? | |
| `isSystem` | Boolean | `@default(false)` |
| `organizationId` | String? | FK → Organization, nullable |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |
| `deletedAt` | DateTime? | Soft delete |

**Relations**: organization?, users[], permissions[] (RolePermission)
**Indexes**: `@@unique([organizationId, name])`, `@@index([organizationId])`

---

### Permission

Global permission definitions. Created by seed, never modified at runtime.

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `name` | String | `@unique` |
| `description` | String? | |
| `createdAt` | DateTime | `@default(now())` |

**Relations**: roles[] (RolePermission)

---

### RolePermission

Junction table linking roles to permissions.

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `roleId` | String | FK → Role |
| `permissionId` | String | FK → Permission |

**Relations**: role, permission
**Indexes**: `@@unique([roleId, permissionId])`

---

### Department

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `name` | String | |
| `description` | String? | |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |
| `deletedAt` | DateTime? | Soft delete |

**Relations**: organization, employees[]
**Indexes**: `@@unique([organizationId, name])`, `@@index([organizationId])`

---

### Employee

Links a User to employment details. One-to-one with User.

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `userId` | String | `@unique`, FK → User |
| `departmentId` | String? | FK → Department, nullable |
| `employeeCode` | String | Auto-generated (EMP-001, EMP-002, ...) |
| `jobTitle` | String | |
| `salaryType` | SalaryType | `MONTHLY` or `HOURLY` |
| `salary` | Decimal? | Required for MONTHLY |
| `hourlyRate` | Decimal? | Required for HOURLY |
| `joiningDate` | DateTime | |
| `status` | EmployeeStatus | `@default(ACTIVE)` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |
| `deletedAt` | DateTime? | |

**Relations**: organization, user, department?, tasks[], submissions[], payrolls[], payments[]
**Indexes**: `@@unique([organizationId, employeeCode])`, `@@index([organizationId])`, `@@index([departmentId])`, `@@index([status])`

---

### Project

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `name` | String | |
| `description` | String? | |
| `startDate` | DateTime? | |
| `endDate` | DateTime? | |
| `budget` | Decimal? | |
| `status` | ProjectStatus | `@default(PLANNED)` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |
| `deletedAt` | DateTime? | Soft delete |

**Relations**: organization, tasks[]
**Indexes**: `@@index([organizationId])`, `@@index([status])`

---

### Task

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `projectId` | String | FK → Project |
| `employeeId` | String | FK → Employee |
| `title` | String | |
| `description` | String? | |
| `estimatedHours` | Decimal? | |
| `priority` | TaskPriority | `@default(MEDIUM)` |
| `status` | TaskStatus | `@default(TODO)` |
| `dueDate` | DateTime? | |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |
| `deletedAt` | DateTime? | Soft delete |

**Relations**: project, employee, submissions[]
**Indexes**: `@@index([projectId])`, `@@index([employeeId])`, `@@index([status])`, `@@index([dueDate])`

---

### WorkSubmission

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `taskId` | String | FK → Task |
| `employeeId` | String | FK → Employee |
| `description` | String | |
| `hoursWorked` | Decimal | |
| `workDate` | DateTime | |
| `status` | SubmissionStatus | `@default(PENDING)` |
| `reviewedBy` | String? | User ID of reviewer |
| `reviewedAt` | DateTime? | |
| `reviewNote` | String? | Required for rejections |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Relations**: task, employee
**Indexes**: `@@index([taskId])`, `@@index([employeeId])`, `@@index([status])`

---

### Payroll

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `employeeId` | String | FK → Employee |
| `periodStart` | DateTime | |
| `periodEnd` | DateTime | |
| `grossAmount` | Decimal | Sum of approved submission hours × rate |
| `deductions` | Decimal | `@default(0)` |
| `netAmount` | Decimal | grossAmount - deductions |
| `status` | PayrollStatus | `@default(DRAFT)` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Relations**: organization, employee, payment?
**Indexes**: `@@unique([employeeId, periodStart, periodEnd])`, `@@index([organizationId])`, `@@index([employeeId])`, `@@index([status])`

---

### Payment

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `payrollId` | String | `@unique`, FK → Payroll |
| `employeeId` | String | FK → Employee |
| `amount` | Decimal | |
| `currency` | String | `@default("BDT")` |
| `transactionId` | String? | `@unique` — Stripe payment intent ID |
| `gateway` | PaymentGateway | `@default(STRIPE)` |
| `status` | PaymentStatus | `@default(PENDING)` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Relations**: organization, payroll, employee
**Indexes**: `@@index([organizationId])`, `@@index([employeeId])`, `@@index([status])`

---

### AuditLog

| Field | Type | Attributes |
|-------|------|------------|
| `id` | String | `@id @default(uuid())` |
| `organizationId` | String | FK → Organization |
| `userId` | String | FK → User |
| `action` | String | Audit action type |
| `entity` | String | Model name |
| `entityId` | String? | Record ID |
| `metadata` | Json? | Additional context |
| `ipAddress` | String? | |
| `createdAt` | DateTime | `@default(now())` |

**Relations**: organization, user
**Indexes**: `@@index([organizationId])`, `@@index([userId])`, `@@index([entity])`, `@@index([createdAt])`

---

## Entity Relationship Diagram

```
Organization ──┬── User ──── Role ──── Permission
               │   │          (via RolePermission)
               │   └── Employee ──┬── Department
               │                   ├── Task ── Project
               │                   ├── WorkSubmission
               │                   ├── Payroll ── Payment
               │                   └── (via User)
               ├── Department
               ├── Project
               ├── Payroll
               ├── Payment
               └── AuditLog
```

## Soft Delete Models

| Model | Field | Query Filter |
|-------|-------|-------------|
| Role | `deletedAt` | `where: { deletedAt: null }` |
| Department | `deletedAt` | `where: { deletedAt: null }` |
| Project | `deletedAt` | `where: { deletedAt: null }` |
| Task | `deletedAt` | `where: { deletedAt: null }` |

Delete operation: `prisma.model.update({ data: { deletedAt: new Date() } })`

## Cascade Delete

All Organization relations use `onDelete: Cascade`:
- Deleting an Organization deletes all its Users, Roles, Departments, Employees, Projects, Payrolls, Payments, AuditLogs
