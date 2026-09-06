# Workflow

System flow diagrams, module connections, and data pipelines.

## Table of Contents

- [Documentation Links](#documentation-links)
- [System Overview](#system-overview)
- [Authentication Flow](#authentication-flow)
- [Employee Lifecycle](#employee-lifecycle)
- [Project & Task Flow](#project--task-flow)
- [Work Submission Flow](#work-submission-flow)
- [Payroll Pipeline](#payroll-pipeline)
- [Payment Pipeline](#payment-pipeline)
- [Permission Chain](#permission-chain)
- [Audit Trail Flow](#audit-trail-flow)
- [Module Dependency Map](#module-dependency-map)

---

## Documentation Links

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Project overview, setup, features |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Project structure, middleware, utilities |
| [DATABASE.md](./DATABASE.md) | All models, relations, indexes |
| [API_INTEGRATION.md](./API_INTEGRATION.md) | All 52 endpoints with examples |
| [WORKFLOW.md](./WORKFLOW.md) | This file — system flows and connections |

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Frontend)                    │
│                  Cookies / Bearer Token                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   EXPRESS APP (app.ts)                   │
│  helmet → rateLimit → cors → json → cookieParser         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              ROUTE MIDDLEWARE CHAIN                      │
│  auth() → checkPermission() → validateRequest()         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  CONTROLLER → SERVICE                    │
│              Business Logic + Validation                 │
└───────┬──────────────┬──────────────┬───────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Prisma     │ │  Stripe  │ │  Cloudinary  │
│  PostgreSQL  │ │ Payments │ │ File Upload  │
└──────────────┘ └──────────┘ └──────────────┘
```

---

## Authentication Flow

```
Register:
  Client → POST /auth/register
    → Validate input (Zod)
    → Create Organization
    → Copy system roles (ADMIN, HR_MANAGER, FINANCE_MANAGER, EMPLOYEE)
    → Create Admin User (hash password)
    → Create AuditLog
    → Return JWT tokens + set cookies

Login:
  Client → POST /auth/login
    → Validate input (Zod)
    → Find user by email
    → Check status (BLOCKED, DELETED)
    → Check authProvider (must be CREDENTIAL)
    → Compare password (bcrypt)
    → Create AuditLog (LOGIN)
    → Return JWT tokens + set cookies

Google Login:
  Client → POST /auth/google
    → Verify Google ID token
    → Find user by googleId or email
    → If not found → reject (must register via org first)
    → Create AuditLog (GOOGLE_LOGIN)
    → Return JWT tokens + set cookies

Token Refresh:
  Client → POST /auth/refresh-token
    → Read refreshToken from cookie
    → Verify JWT signature
    → Check user exists, not deleted/blocked
    → Check tokenVersion matches (invalidates on password change)
    → Return new token pair

Logout:
  Client → POST /auth/logout (auth required)
    → Clear cookies
    → Return success
```

**Token Lifecycle**:
```
Register/Login → tokens issued
  → Access token expires (24h) → /refresh-token → new pair
  → Refresh token expires (7d) → re-login required
  → Password changed → tokenVersion incremented → all tokens invalidated
```

---

## Employee Lifecycle

```
                     ┌──────────────┐
                     │   Register   │
                     │  (Admin)     │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Create Emp   │ ← POST /employees
                     │ (HR/Admin)   │    creates User + Employee
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  ACTIVE  │  │ INACTIVE │  │SUSPENDED │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             │   ┌──────────┘              │
             ▼   ▼                         ▼
        ┌──────────┐                 ┌──────────┐
        │ Can work │                 │TERMINATED│
        │ Can login│                 │ (locked) │
        │ Can view │                 └──────────┘
        └──────────┘

Status Transitions:
  ACTIVE → INACTIVE (admin/HR)
  ACTIVE → SUSPENDED (admin/HR)
  ACTIVE → TERMINATED (admin, or delete endpoint)
  INACTIVE → ACTIVE (admin/HR)
  SUSPENDED → ACTIVE (admin/HR)
  
Restrictions:
  - Cannot change own status to negative state
  - Cannot change admin's status to negative state
  - Cannot terminate yourself
  - Cannot terminate admin
  - TERMINATED employees blocked at auth middleware
```

---

## Project & Task Flow

```
┌─────────────────────────────────────────────────────────┐
│                    PROJECT LIFECYCLE                      │
│                                                          │
│  PLANNED ──→ ACTIVE ──→ COMPLETED                       │
│    │           │                                          │
│    │           ├──→ ON_HOLD ──→ ACTIVE                   │
│    │           │                                          │
│    │           └──→ CANCELLED                            │
│    │                                                      │
│    └──→ CANCELLED                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    TASK LIFECYCLE                         │
│                                                          │
│  TODO ──→ IN_PROGRESS ──→ SUBMITTED ──→ APPROVED ──→ COMPLETED │
│                │              │                            │
│                │              └──→ REJECTED ──→ IN_PROGRESS│
│                │                      (resubmit loop)     │
│                └──→ COMPLETED (skip submission)           │
└─────────────────────────────────────────────────────────┘

Creation Flow:
  Admin/HR creates Project
    → Assigns employees to tasks
    → Employee sees tasks via GET /tasks/my
    → Employee works and submits via POST /submissions
    → Manager approves/rejects
    → Approved submissions feed into payroll generation

Deletion Rules:
  - Project: blocked if has active (non-deleted) tasks
  - Task: blocked if has any submissions (even rejected ones)
  - Both use soft delete (deletedAt)
```

---

## Work Submission Flow

```
Employee                    Manager/Admin
   │                              │
   │  1. POST /submissions        │
   │  { taskId, description,      │
   │    hoursWorked, workDate }   │
   │ ─────────────────────────→   │
   │                              │
   │  Status: PENDING             │
   │                              │
   │               2. GET /submissions (view all)
   │               ←─────────────│
   │                              │
   │               3. POST /submissions/:id/approve
   │               OR POST /submissions/:id/reject
   │               { reason }     │
   │ ←───────────────────────────│
   │                              │
   │  Status: APPROVED/REJECTED   │
   │                              │
   │  If REJECTED:                │
   │  4. Employee can resubmit    │
   │  POST /submissions           │
   │  (new submission for same    │
   │   task with updated work)    │
   │ ─────────────────────────→   │
   │                              │

Rules:
  - Cannot approve your own submission
  - Rejection requires a reason (min 10 chars)
  - Approved submissions count toward payroll
  - Each submission = one work entry (hours + description)
```

---

## Payroll Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Approved │ →  │ Generate │ →  │ Approve  │ →  │  Create  │
│Submissions│   │ Payroll  │   │ Payroll  │   │ Payment  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Step 1: Generate Payroll
  Finance Manager → POST /payroll/generate
    { employeeId, periodStart, periodEnd, deductions }
  
  Service:
    → Find all APPROVED submissions in date range
    → Calculate grossAmount (sum of hours × rate)
    → Subtract deductions
    → netAmount = gross - deductions
    → Create Payroll record (status: GENERATED)
    → Create AuditLog

Step 2: Approve Payroll
  Finance Manager → POST /payroll/:id/approve
  
  Service:
    → Check payroll status is GENERATED
    → Cannot approve own payroll
    → Update status to APPROVED
    → Create AuditLog

Step 3: Create Payment
  Finance Manager → POST /payments
    { payrollId, currency }
  
  Service:
    → Check payroll is APPROVED
    → Create Stripe Checkout Session
    → Create Payment record (status: PENDING)
    → Return session URL
    → Create AuditLog

Step 4: Stripe Webhook
  Stripe → POST /payments/webhook
  
  Service:
    → Verify Stripe signature
    → Handle checkout.session.completed
    → Update Payment status to COMPLETED
    → Update Payroll status to PAID
    → Idempotent (skips if already processed)

Status Flow:
  Payroll: DRAFT → GENERATED → APPROVED → PROCESSING → PAID
                                            ↓
                                         REJECTED
  
  Payment: PENDING → PROCESSING → COMPLETED
                                    ↓
                                 FAILED/REFUNDED
```

---

## Payment Pipeline

```
Frontend                     Backend                      Stripe
   │                            │                            │
   │ 1. POST /payments          │                            │
   │ { payrollId, currency }    │                            │
   │ ────────────────────────→  │                            │
   │                            │ 2. stripe.checkout         │
   │                            │    .sessions.create()      │
   │                            │ ──────────────────────→    │
   │                            │                            │
   │                            │ ←──────────────────────    │
   │                            │    session.id, session.url │
   │  ←────────────────────────│                            │
   │  { sessionId, sessionUrl } │                            │
   │                            │                            │
   │ 3. User completes payment  │                            │
   │ ──────────────────────────────────────────────────────→ │
   │                            │                            │
   │                            │ 4. Stripe Webhook          │
   │                            │ POST /payments/webhook     │
   │                            │ ←────────────────────────  │
   │                            │                            │
   │                            │ 5. Verify signature        │
   │                            │ Update Payment → COMPLETED │
   │                            │ Update Payroll → PAID      │
   │                            │                            │
```

---

## Permission Chain

```
┌─────────────────────────────────────────────────────────┐
│                    SEED (First Run)                       │
│                                                          │
│  1. Create 42 Permission records                        │
│  2. Create 4 System Roles (isSystem: true, orgId: null) │
│     - ADMIN → all 42 permissions                        │
│     - HR_MANAGER → workforce permissions                │
│     - FINANCE_MANAGER → financial permissions           │
│     - EMPLOYEE → basic permissions                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               ORGANIZATION REGISTRATION                  │
│                                                          │
│  1. Create Organization                                 │
│  2. Copy each system role → new role (orgId set)        │
│  3. Assign ADMIN role to first user                     │
│  4. User gets role → RolePermission → Permission names  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  REQUEST MIDDLEWARE                       │
│                                                          │
│  auth()                                                 │
│    → Verify JWT                                         │
│    → Load user + role + permissions from DB             │
│    → Attach to req.user.permissions: string[]           │
│                                                          │
│  checkPermission("task.create")                         │
│    → Read req.user.permissions                          │
│    → Check "task.create" exists                         │
│    → If no → 403 Forbidden                              │
│    → If yes → next()                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  SERVICE LAYER                           │
│                                                          │
│  checkUserPermission(userId, perm) ← for inline checks  │
│    → Query DB for fresh permissions                     │
│    → Used in payroll.view_own checks                    │
└─────────────────────────────────────────────────────────┘
```

---

## Audit Trail Flow

```
Every significant action:

  Service Function
       │
       ├── 1. Perform business operation (create/update/delete)
       │
       └── 2. createAuditLog({ user, action, entity, entityId, metadata })
              │
              └── prisma.auditLog.create() (fire-and-forget, errors logged silently)

Queryable via:
  GET /audit-logs → paginated list
  GET /audit-logs/:id → single record

Filterable by: entity, action, userId, date range
```

---

## Module Dependency Map

```
                    ┌──────────┐
                    │   Auth   │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │Organization│ │    Role    │ │  Employee  │
   └────────────┘ └─────┬──────┘ └─────┬──────┘
                         │              │
                    ┌────┴────┐    ┌────┴────┐
                    │Permission│   │Department│
                    └─────────┘    └─────────┘
                                       │
                         ┌─────────────┼─────────────┐
                         ▼             ▼             │
                  ┌────────────┐ ┌──────────┐        │
                  │   Project  │ │   Task   │        │
                  └────────────┘ └─────┬────┘        │
                                       │             │
                                       ▼             │
                                ┌────────────┐       │
                                │ Submission │       │
                                └─────┬──────┘       │
                                      │              │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             │
                 ┌────────────┐ ┌──────────┐        │
                 │  Payroll   │ │ Payment  │        │
                 └────────────┘ └──────────┘        │
                                                    │
                                              ┌─────┴──────┐
                                              │ Audit Log  │
                                              └────────────┘

Dependency Rules:
  - Employee depends on: User, Role, Department (optional)
  - Task depends on: Project, Employee
  - Submission depends on: Task, Employee
  - Payroll depends on: Employee, Organization
  - Payment depends on: Payroll, Employee, Organization
  - AuditLog depends on: User, Organization

Cascade Delete:
  Organization deleted → all child records deleted
  Project soft-deleted → tasks remain (soft-deleted separately)
  Task soft-deleted → submissions remain (permanent)
```

---

## Data Flow Summary

```
User Action          API Endpoint              Service              Database
─────────────────────────────────────────────────────────────────────────────
Register             POST /auth/register       AuthService.register  Organization + User + Roles
Login                POST /auth/login          AuthService.loginUser User (read)
Create Employee      POST /employees           EmployeeService       User + Employee + Email
Assign Task          POST /tasks/:id/assign    TaskService           Task (update)
Submit Work          POST /submissions         SubmissionService     WorkSubmission
Approve Submission   POST /submissions/:id/approve  SubmissionService  WorkSubmission (update)
Generate Payroll     POST /payroll/generate    PayrollService        Payroll (create)
Approve Payroll      POST /payroll/:id/approve PayrollService       Payroll (update)
Create Payment       POST /payments            PaymentService        Payment (create) + Stripe
Webhook              POST /payments/webhook    PaymentService        Payment + Payroll (update)
View Analytics       GET /analytics/dashboard  AnalyticsService      Multiple (read)
```
