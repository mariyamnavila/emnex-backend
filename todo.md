# WorkFlow ERP — Development Todo

This file is excluded from git commits and serves as a shared checklist to track our development progress on the WorkFlow ERP backend.

---

## Project Phases

### Phase 1: Database & Foundation (Current)
- [ ] Configure Prisma schema in `prisma/schema/schema.prisma`
- [ ] Create core PostgreSQL schemas:
  - [ ] **Enums** (`SalaryType`, `EmployeeStatus`, `ProjectStatus`, `TaskStatus`, `TaskPriority`, `SubmissionStatus`, `PayrollStatus`, `PaymentGateway`, `PaymentStatus`)
  - [ ] **Organization** (multi-tenant root)
  - [ ] **User** (with role, org, soft delete)
  - [ ] **Role** & **Permission** & **RolePermission** (custom RBAC)
  - [ ] **Department** (org-scoped)
  - [ ] **Employee** (linked to User)
  - [ ] **Project** (org-scoped)
  - [ ] **Task** (assigned to employee, linked to project)
  - [ ] **WorkSubmission** (employee submits completed work)
  - [ ] **Payroll** (generated from approved work)
  - [ ] **Payment** (Stripe integration)
  - [ ] **AuditLog** (track all critical actions)
- [ ] Run `npx prisma migrate dev`
- [ ] Seed default data (system roles + permissions)
- [ ] Set up folder structure (modular monolith)
- [ ] Exclude `todo.md` from git commit using `.gitignore`

---

### Phase 2: Core Utilities & Middleware
- [ ] Create `src/app/utils/AppError.ts` (custom error class)
- [ ] Create `src/app/utils/catchAsync.ts` (async error wrapper)
- [ ] Create `src/app/utils/jwt.ts` (createToken / verifyToken)
- [ ] Create `src/app/utils/sendResponse.ts` (standardized response)
- [ ] Create `src/app/interfaces/index.ts` (shared types)
- [ ] Create `src/app/lib/prisma.ts` (Prisma client)
- [ ] Create `src/app/lib/redis.ts` (Redis client)
- [ ] Create `src/app/middleware/checkAuth.ts` (JWT auth + role check)
- [ ] Create `src/app/middleware/validateRequest.ts` (Zod validation)
- [ ] Create `src/app/middleware/globalErrorHandler.ts`
- [ ] Create `src/app/middleware/notFound.ts`

---

### Phase 3: Authentication & User Management
- [ ] Implement company registration + admin user (`POST /api/v1/auth/register`)
- [ ] Implement user login (`POST /api/v1/auth/login`)
- [ ] Implement Google OAuth login (`POST /api/v1/auth/google`)
- [ ] Implement refresh token (`POST /api/v1/auth/refresh`)
- [ ] Implement logout (`POST /api/v1/auth/logout`)
- [ ] Implement get current user (`GET /api/v1/auth/me`)
- [ ] Implement change password (`POST /api/v1/auth/change-password`)

---

### Phase 4: Organization Management
- [ ] Implement create organization (`POST /api/v1/organizations`)
- [ ] Implement get organization details (`GET /api/v1/organizations/:id`)
- [ ] Implement update organization (`PATCH /api/v1/organizations/:id`)
- [ ] Implement organization statistics (`GET /api/v1/organizations/:id/stats`)

---

### Phase 5: Role & Permission Management
- [ ] Implement create role (`POST /api/v1/roles`)
- [ ] Implement list roles (`GET /api/v1/roles`)
- [ ] Implement get role details (`GET /api/v1/roles/:id`)
- [ ] Implement update role (`PATCH /api/v1/roles/:id`)
- [ ] Implement delete role (`DELETE /api/v1/roles/:id`)
- [ ] Implement list permissions (`GET /api/v1/permissions`)
- [ ] Implement assign permissions to role (`POST /api/v1/roles/:roleId/permissions`)
- [ ] Implement remove permission from role (`DELETE /api/v1/roles/:roleId/permissions/:permissionId`)
- [ ] Implement get role permissions (`GET /api/v1/roles/:roleId/permissions`)

---

### Phase 6: Department Management
- [ ] Implement create department (`POST /api/v1/departments`)
- [ ] Implement list departments with pagination (`GET /api/v1/departments`)
- [ ] Implement get department details (`GET /api/v1/departments/:id`)
- [ ] Implement update department (`PATCH /api/v1/departments/:id`)
- [ ] Implement soft delete department (`DELETE /api/v1/departments/:id`)
- [ ] Implement list employees in department (`GET /api/v1/departments/:id/employees`)

---

### Phase 7: Employee Management
- [ ] Implement create employee with temp password (`POST /api/v1/employees`)
- [ ] Implement list employees with pagination, search, filter (`GET /api/v1/employees`)
- [ ] Implement get employee details (`GET /api/v1/employees/:id`)
- [ ] Implement update employee (`PATCH /api/v1/employees/:id`)
- [ ] Implement soft delete employee (`DELETE /api/v1/employees/:id`)
- [ ] Implement employee statistics (`GET /api/v1/employees/:id/stats`)

---

### Phase 8: Project Management
- [ ] Implement create project (`POST /api/v1/projects`)
- [ ] Implement list projects with pagination, filter (`GET /api/v1/projects`)
- [ ] Implement get project details (`GET /api/v1/projects/:id`)
- [ ] Implement update project (`PATCH /api/v1/projects/:id`)
- [ ] Implement soft delete project (`DELETE /api/v1/projects/:id`)
- [ ] Implement list tasks in project (`GET /api/v1/projects/:id/tasks`)
- [ ] Implement project statistics (`GET /api/v1/projects/:id/stats`)

---

### Phase 9: Task Management
- [ ] Implement create task (`POST /api/v1/tasks`)
- [ ] Implement list tasks with pagination, filter (`GET /api/v1/tasks`)
- [ ] Implement get task details (`GET /api/v1/tasks/:id`)
- [ ] Implement update task (`PATCH /api/v1/tasks/:id`)
- [ ] Implement soft delete task (`DELETE /api/v1/tasks/:id`)
- [ ] Implement assign task to employee (`POST /api/v1/tasks/:id/assign`)
- [ ] Implement update task status — state machine (`PATCH /api/v1/tasks/:id/status`)
- [ ] Implement get my assigned tasks (`GET /api/v1/tasks/my`)
- [ ] Implement list submissions for task (`GET /api/v1/tasks/:id/submissions`)

---

### Phase 10: Work Submission & Approval
- [ ] Implement submit completed work (`POST /api/v1/submissions`)
- [ ] Implement list submissions with pagination (`GET /api/v1/submissions`)
- [ ] Implement get submission details (`GET /api/v1/submissions/:id`)
- [ ] Implement update submission (`PATCH /api/v1/submissions/:id`)
- [ ] Implement get my submissions (`GET /api/v1/submissions/my`)
- [ ] Implement approve submission — DB transaction (`POST /api/v1/submissions/:id/approve`)
- [ ] Implement reject submission with reason (`POST /api/v1/submissions/:id/reject`)

---

### Phase 11: Payroll Management
- [ ] Implement generate payroll (`POST /api/v1/payroll/generate`)
- [ ] Implement list payroll records with pagination (`GET /api/v1/payroll`)
- [ ] Implement get payroll details (`GET /api/v1/payroll/:id`)
- [ ] Implement get my payroll (`GET /api/v1/payroll/my`)
- [ ] Implement approve payroll (`POST /api/v1/payroll/:id/approve`)
- [ ] Implement reject payroll (`POST /api/v1/payroll/:id/reject`)
- [ ] Implement payroll summary (`GET /api/v1/payroll/summary`)

---

### Phase 12: Payment Integration (Stripe)
- [ ] Integrate Stripe SDK (`src/app/lib/stripe.ts`)
- [ ] Implement initiate payment (`POST /api/v1/payments`)
- [ ] Implement create checkout session (`POST /api/v1/payments/checkout`)
- [ ] Implement Stripe webhook handler (`POST /api/v1/payments/webhook`)
- [ ] Implement list payments with pagination (`GET /api/v1/payments`)
- [ ] Implement get payment details (`GET /api/v1/payments/:id`)
- [ ] Implement get my payments (`GET /api/v1/payments/my`)
- [ ] Implement check payment status (`GET /api/v1/payments/:id/status`)

---

### Phase 13: Analytics & Audit
- [ ] Implement admin dashboard stats (`GET /api/v1/analytics/dashboard`)
- [ ] Implement employee analytics (`GET /api/v1/analytics/employees`)
- [ ] Implement project analytics (`GET /api/v1/analytics/projects`)
- [ ] Implement payroll analytics (`GET /api/v1/analytics/payroll`)
- [ ] Implement payment analytics (`GET /api/v1/analytics/payments`)
- [ ] Implement list audit logs with pagination, filter (`GET /api/v1/audit-logs`)
- [ ] Implement get audit log details (`GET /api/v1/audit-logs/:id`)

---

### Phase 14: App Setup, Security & Final Polish
- [ ] Mount all routes in `src/app.ts` under `/api/v1/`
- [ ] Create `src/server.ts` (connect DB + Redis, seed, start)
- [ ] Add rate limiting (express-rate-limit)
- [ ] Add helmet security headers
- [ ] Verify all routes have auth + permission middleware
- [ ] Verify org isolation on all queries
- [ ] Verify soft deletes on all major models
- [ ] Postman collection with all endpoints documented

---

## Git Commits (24 total)

| # | Commit Message |
|---|---------------|
| 1 | Project initialization & config setup |
| 2 | Prisma schema — Organization, User, Role, Permission |
| 3 | Prisma schema — Department, Employee, Project |
| 4 | Prisma schema — Task, WorkSubmission, Payroll, Payment, AuditLog |
| 5 | Core utilities (AppError, catchAsync, jwt, sendResponse) |
| 6 | Prisma client & Redis client setup |
| 7 | Middleware (auth, validation, error handler, notFound) |
| 8 | Seed data — Default roles & permissions |
| 9 | Auth module — Register (create company + admin) |
| 10 | Auth module — Login, Refresh, Logout, Me, Change Password |
| 11 | Auth module — Google OAuth |
| 12 | App setup & server startup |
| 13 | Organization module |
| 14 | Role & Permission module |
| 15 | Department module |
| 16 | Employee module |
| 17 | Project module |
| 18 | Task module |
| 19 | Work Submission module (with approval transaction) |
| 20 | Payroll module |
| 21 | Payment module — Stripe integration |
| 22 | Analytics module |
| 23 | Audit Log module |
| 24 | Security hardening & final polish |

---

## Optional (If Time Permits)

- [ ] Multi-organization support (Membership model — user can belong to multiple orgs)
- [ ] Multi-employee per task assignment (currently: one employee per task)
- [ ] bkash / SSLCOMMERZ payment gateway integration
- [ ] AI-powered payroll generation (auto-calculate from approved submissions)
- [ ] PDF generation for payslips

---

## Notes & Guidelines
1. **Preserve Coding Style**: Follow the style established in `PH-Healthcare-Backend` (Modular file layout, route-controller-service separation, catchAsync, sendResponse, AppError patterns).
2. **Prisma Client**: Generated at `generated/prisma` to avoid polluting default imports.
3. **Response Format**: `{ success, statusCode, message, data, meta }`
4. **Each Module**: Has `*.controller.ts`, `*.service.ts`, `*.route.ts`, `*.validation.ts`, `*.interface.ts`
