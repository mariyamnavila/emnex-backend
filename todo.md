# EmNex Backend — Development Todo

This file is excluded from git commits and serves as a shared checklist to track our development progress on the EmNex backend.

---

## 📝 Frontend Integration Changes (EmNex-Frontend)

> **Rule:** We HAVE permission to modify this backend while building `Milestone-6/EmNex-Frontend`. Any such change must be logged here with date, files touched, and reason — regardless of how small. Frontend-only work never touches the backend.

| Date | Change | Files | Reason | Status |
|------|--------|-------|--------|--------|
| 2026-10-04 | Auth: (1) change-password re-issues this session's cookies (other sessions are signed out by the tokenVersion bump, this one stays in instead of dropping when its access token expires); (2) shared `issueTokens` (service) + `setAuthCookies` (controller) replace 4 copies of payload/token creation and cookie setting (register, login, refresh, Google); (3) avatar uploads: limit really 5 MB (was 10 MB with a "5MB" comment), wrong type → 400 AppError, `MulterError` → 400 in the global handler ("The file is too large (5 MB max)") instead of 500 | `auth.service.ts`, `auth.controller.ts`, `lib/multer.ts`, `middleware/globalErrorHandler.ts` | Profile page: change password + avatar upload | ✅ |
| 2026-10-04 | `POST /payments` refuses to start a payment for your own payroll (403 "You can't pay your own payroll"), whatever your permissions — same rule as approving your own payroll | `payment.service.ts` | Access is permission-based, so a role given `payment.create` could otherwise pay itself; the frontend hid it but the API didn't stop it | ✅ |
| 2026-10-04 | Task status ownership: on `PATCH /tasks/:id/status` the assignee may only move their own task to IN_PROGRESS / SUBMITTED (start, restart, submit) and must be ACTIVE; changing anyone else's task needs `task.assign` or `submission.approve` (admin, HR manager). Work logs: `hoursWorked` ≤ 24 and `workDate` not in the future (1-day grace for time zones) on create + update | `task.service.ts`, `submission.validation.ts` | Employees have `task.update`, so they could approve their own submitted task or move other people's tasks; hours could be any size and dated in the future | ✅ |
| 2026-10-04 | `GET /submissions/my` rows include `task.project {id,name}` (same as the manager list) | `submission.service.ts` | Employee dashboard / my-submissions show which project each log belongs to | ✅ |
| 2026-10-04 | Demo seed: the seeded COMPLETED payment (`demo_txn_001`) now belongs to the manager's PAID Jan payroll ($5,400) instead of the employee's APPROVED Jan payroll. Live DB fixed the same way with a one-off script (payment `7968bf32…` → payroll `b56e1c2f…`, employee EMP-001, amount 5400; before: payroll `c1b18915…`, EMP-002, 3600). Now PAID total = completed payments = $9,000 and EMP-002 Jan is a genuine "ready to pay" | `scripts/seed-demo.ts` (+ data) | An APPROVED payroll had a COMPLETED payment and a PAID one had none, so the finance overview showed $3,600 "ready to pay" that was already paid | ✅ |
| 2026-10-04 | Rejected payroll left out of money totals: `/analytics/payroll` totals + monthly trend, and `totalPayroll` on the ADMIN and FINANCE_MANAGER dashboards (byStatus still lists REJECTED so the donut shows it) | `analytics.service.ts` | A rejected −$30 draft showed as a negative bar and lowered "Total payroll" — money that was never owed | ✅ |
| 2026-10-04 | Approving / rejecting a work submission no longer changes the task's status (approve used to set the task to SUBMITTED, reject to REJECTED). A task can have many daily work logs; reviewing hours is for payroll, the task moves only through its own status workflow. Submission update + audit log still in one transaction. Matches WORKFLOW.md | `submission.service.ts` | Approving one day's hours marked an in-progress task as "submitted", knocked an already-approved task back, and one bad log rejected the whole task | ✅ |
| 2026-10-03 | HR manager dashboard: `GET /analytics/dashboard` (HR_MANAGER) adds `pendingSubmissions`, `pendingHours`, `approvedHoursThisMonth`; month start fixed (was "the 1st at the current time of day"); departments exclude soft-deleted. `GET /analytics/employees` byDepartment excludes soft-deleted departments. `GET /submissions` rows include `task.project {id,name}` and accept `sortOrder=asc` (review queue = oldest first) | `analytics.service.ts`, `submission.service.ts`, `submission.controller.ts`, `submission.interface.ts` | Manager overview needs a pending-review count + hours, and the queue shows which project each log belongs to | ✅ |
| 2026-10-03 | Readable audit metadata: convention = names next to ids (employeeName, roleName, projectName, taskTitle, departmentName), money as numbers, ISO dates, updates as `changes: {field: {from,to}}` (only changed fields; no-op updates not logged); ASSIGN_PERMISSIONS stores `added`/`removed` permission names + total; status-only updates use CHANGE_EMPLOYEE_STATUS / CHANGE_PROJECT_STATUS; payroll/payment entries carry employee name, period, amounts (Decimal → number); helpers `toAuditValue`, `diffFields` in `utils/auditLog.ts` | `utils/auditLog.ts`, employee/department/role/project/task/submission/payroll/payment services | Audit details showed raw UUID lists and Decimal strings | ✅ |
| 2026-10-03 | Checkout speed: payroll + existing-payment lookups in parallel; old session expired in the background (not awaited) — saves ~1 DB round trip + 1 Stripe call (~0.7–1.8 s) before the redirect | `payment.service.ts` | "Opening Stripe takes lots of time" | ✅ |
| 2026-10-03 | Payments: (1) retry after cancelled/abandoned checkout — non-COMPLETED payment reuses its record (upsert) and the old Stripe session is expired; COMPLETED → 409 "already been paid"; (2) new `GET /payments/verify/:sessionId` (auth + `payment.view`, org-checked) asks Stripe if the session is paid and completes payment/payroll via shared `completePayment` (same as webhook, idempotent); (3) audit: PAYMENT_COMPLETED logged exactly once inside `completePayment` (source webhook|verify), PAYMENT_FAILED on failures — webhook events attributed to the user who initiated the payment (from its PAYMENT_INITIATED log); `payment_intent_data.metadata.payrollId` so `payment_intent.payment_failed` can find the payment (was looking up by intent id, never matched) | `payment.service.ts`, `payment.controller.ts`, `payment.route.ts` | Cancel → Pay again was blocked forever ("Payment already exists"); success page had no way to confirm, and payments stayed PROCESSING without the Stripe CLI forwarding webhooks | ✅ |
| 2026-10-03 | Payroll generate guards: reject future periods, hourly with no rate or 0 approved hours, monthly with no salary, deductions > gross; amounts rounded to cents | `src/app/module/payroll/payroll.service.ts` | A draft for an hourly employee with no hours was saved with gross $0 and net −$30 | ✅ |
| 2026-10-02 | Rate limits: strict 20/15 min limiter only on `/auth/login`, `/register`, `/google`, `/change-password` (was all of `/auth`, incl. `/auth/me` + refresh → 429s in normal use); general limit 100 → 300/15 min; JSON 429 bodies in the API envelope; `cors()` before limiters (429s were unreadable in the browser); `trust proxy` on Vercel (`VERCEL` env) so users don't share one IP bucket | `src/app.ts`, `src/app/config/index.ts` | Users were bounced to the retry screen/login during normal browsing; production would rate-limit everyone together | ✅ |
| 2026-10-02 | Performance: (1) `relationJoins` preview → nested `include` = 1 SQL query (auth() was 5 sequential queries/request); (2) pg pool keeps idle connections 5 min instead of 10 s (reconnect = 2–3 s over TLS); (3) `app.listen` before `seed()` (seed runs in background). Measured: startup to listening 6.9 s → 1.8 s, login 6.1 s → 0.4 s, `/auth/me` ~5.5 s → 0.8 s, `/employees` 1.8–3.6 s → 0.7 s | `prisma/schema/schema.prisma` (+ `npx prisma generate`), `src/app/lib/prisma.ts`, `src/server.ts` | Each DB round trip is ~285 ms (remote Prisma Postgres region) — fewer round trips + no reconnects | ✅ |
| 2026-09-30 | Added `FRONTEND_URL=http://localhost:3000` | `.env` | CORS origin missing → browser calls from `localhost:3000` fail (`cors({ origin: config.frontend_url, credentials: true })`) | ✅ |
| _pending_ | Add `submission.update` to seeded permissions (or drop the check) | `src/app/utils/seed.ts` (`src/app/module/submission/...`) | `PATCH /submissions/:id` requires `submission.update` which is not in the 40 seeded permissions → route returns 403 for **every** role incl. ADMIN | ⬜ |
| _pending_ | Verify `APP_URL=http://localhost:3000` (already set) | `.env` | Stripe success/cancel redirects must land on frontend `/payment/success` & `/payment/cancel` — value already correct for local dev; update to prod URL on deploy | ✅ |

**Known issues — open decision (backend change allowed, but only if it helps):**
- `EMPLOYEE` role lacks `analytics.view` → OPTION A: add the permission to the seed so the employee dashboard can use `/analytics/dashboard`, OR OPTION B: frontend builds the employee overview from `/tasks/my`, `/submissions/my`, `/payroll/my`, `/payments/my` (no backend change). Decide when building Day 3.
- Employees lack `task.update` → OPTION A: add it so employees can move own task status (TODO→IN_PROGRESS→SUBMITTED), OR OPTION B: read-only "My Tasks" + log hours only (`submission.create`). OPTION A gives a better employee workflow — likely worth the seed change + migration.
- Only 40 permissions seeded while README claims 42 — align docs or seed when touched.

---

## Assignment Requirements Checklist

### 1. API Design & Documentation (15%)
- [x] RESTful design with proper endpoint structure
- [x] API versioning (`/api/v1/...`)
- [x] Consistent response format (`{ success, statusCode, message, data, meta }`)
- [ ] Postman/Swagger documentation **[TODO]**

### 2. Database Design & Schema (15%)
- [x] Prisma schema with multi-file structure
- [x] Relationships with proper constraints
- [x] Migrations applied
- [x] Seed data (38 permissions, 4 system roles)

### 3. Authentication & Authorization (15%)
- [x] Email/Password authentication
- [x] Google OAuth (GCP) integration
- [x] 3+ roles (ADMIN, HR_MANAGER, FINANCE_MANAGER, EMPLOYEE)
- [x] JWT/session handling with refresh tokens
- [x] Protected routes with role-based middleware

### 4. Core Functionality & Business Logic (20%)
- [x] CRUD operations for all modules
- [x] Workflows (task status transitions, submission approval)
- [x] Status management (employee status, task status, payroll status)
- [x] Role-based operations

### 5. Error Handling & Validation (10%)
- [x] Zod validation on all inputs
- [x] Structured error messages
- [x] 404 handling
- [x] Edge case handling

### 6. Payment Integration (10%)
- [x] Stripe integration with checkout sessions
- [x] Webhook handling for payment status
- [x] Payment flow and status tracking

### 7. Performance & Code Quality (5%)
- [x] Database indexing on foreign keys
- [x] Redis caching setup
- [x] Modular architecture
- [x] Clean code with consistent style

### 8. Deployment (5%)
- [ ] Working production API **[TODO]**
- [ ] Environment configuration **[TODO]**
- [ ] DB connection **[TODO]**

### 9. Commit History (2%)
- [x] 24 meaningful commits (exceeds 20 minimum)

### 10. Video Explanation (3%)
- [ ] 5-10 minute API walkthrough **[TODO]**

---

## Project Phases

### Phase 1: Database & Foundation
- [x] Configure Prisma schema in `prisma/schema/*.prisma` (multi-file)
- [x] Create core PostgreSQL schemas:
  - [x] **Enums** (SalaryType, EmployeeStatus, ProjectStatus, TaskStatus, TaskPriority, SubmissionStatus, PayrollStatus, PaymentGateway, PaymentStatus, AuditAction, etc.)
  - [x] **Organization** (multi-tenant root)
  - [x] **User** (with role, org, soft delete)
  - [x] **Role** & **Permission** & **RolePermission** (custom RBAC)
  - [x] **Department** (org-scoped)
  - [x] **Employee** (linked to User)
  - [x] **Project** (org-scoped)
  - [x] **Task** (assigned to single employee, linked to project)
  - [x] **WorkSubmission** (employee submits completed work)
  - [x] **Payroll** (generated from approved work)
  - [x] **Payment** (Stripe checkout session)
  - [x] **AuditLog** (track all critical actions)
- [x] Run `npx prisma migrate dev`
- [x] Seed default data (system roles + permissions)
- [x] Set up folder structure (modular monolith)

---

### Phase 2: Core Utilities & Middleware
- [x] Create `src/app/utils/AppError.ts` (custom error class)
- [x] Create `src/app/utils/catchAsync.ts` (async error wrapper)
- [x] Create `src/app/utils/jwt.ts` (createToken / verifyToken)
- [x] Create `src/app/utils/sendResponse.ts` (standardized response)
- [x] Create `src/app/interfaces/index.ts` (shared types)
- [x] Create `src/app/lib/prisma.ts` (Prisma client with PrismaPg adapter)
- [x] Create `src/app/lib/redis.ts` (Redis client)
- [x] Create `src/app/middleware/checkAuth.ts` (JWT auth + role check)
- [x] Create `src/app/middleware/validateRequest.ts` (Zod validation)
- [x] Create `src/app/middleware/globalErrorHandler.ts`
- [x] Create `src/app/middleware/notFound.ts`
- [x] Create `src/app/utils/employeeStatus.ts` (shared status check functions)
- [x] Create `src/app/utils/auditLog.ts` (fire-and-forget audit logging)

---

### Phase 3: Authentication & User Management
- [x] Implement company registration + admin user (`POST /api/v1/auth/register`)
- [x] Implement user login (`POST /api/v1/auth/login`)
- [x] Implement Google OAuth login (`POST /api/v1/auth/google`)
- [x] Implement refresh token (`POST /api/v1/auth/refresh-token`)
- [x] Implement logout (`POST /api/v1/auth/logout`)
- [x] Implement get current user (`GET /api/v1/auth/me`)
- [x] Implement change password (`POST /api/v1/auth/change-password`)
- [x] Implement upload avatar (`POST /api/v1/auth/upload-avatar`)

---

### Phase 4: Organization Management
- [x] Implement get my organization (`GET /api/v1/organizations/me`)
- [x] Implement get organization details (`GET /api/v1/organizations/:id`)
- [x] Implement update organization (`PATCH /api/v1/organizations/:id`)
- [x] Implement organization statistics (`GET /api/v1/organizations/:id/stats`)

---

### Phase 5: Role & Permission Management
- [x] Implement create role (`POST /api/v1/roles`)
- [x] Implement list roles (`GET /api/v1/roles`)
- [x] Implement get role details (`GET /api/v1/roles/:id`)
- [x] Implement update role (`PATCH /api/v1/roles/:id`)
- [x] Implement delete role (`DELETE /api/v1/roles/:id`)
- [x] Implement list all permissions (`GET /api/v1/roles/permissions/all`)
- [x] Implement get role permissions (`GET /api/v1/roles/:roleId/permissions`)
- [x] Implement assign permissions to role (`POST /api/v1/roles/:roleId/permissions`)
- [x] Implement remove permission from role (`DELETE /api/v1/roles/:roleId/permissions/:permissionId`)

---

### Phase 6: Department Management
- [x] Implement create department (`POST /api/v1/departments`)
- [x] Implement list departments with pagination (`GET /api/v1/departments`)
- [x] Implement get department details (`GET /api/v1/departments/:id`)
- [x] Implement update department (`PATCH /api/v1/departments/:id`)
- [x] Implement delete department (`DELETE /api/v1/departments/:id`)
- [x] Implement list employees in department (`GET /api/v1/departments/:id/employees`)

---

### Phase 7: Employee Management
- [x] Implement create employee with temp password (`POST /api/v1/employees`)
- [x] Implement list employees with pagination, search, filter (`GET /api/v1/employees`)
- [x] Implement get employee details (`GET /api/v1/employees/:id`)
- [x] Implement update employee (`PATCH /api/v1/employees/:id`)
- [x] Implement delete employee (`DELETE /api/v1/employees/:id`)
- [x] Implement employee statistics (`GET /api/v1/employees/:id/stats`)
- [x] Implement resend credentials (`POST /api/v1/employees/:id/resend-credentials`)

---

### Phase 8: Project Management
- [x] Implement create project (`POST /api/v1/projects`)
- [x] Implement list projects with pagination, filter (`GET /api/v1/projects`)
- [x] Implement get project details (`GET /api/v1/projects/:id`)
- [x] Implement update project (`PATCH /api/v1/projects/:id`)
- [x] Implement delete project (`DELETE /api/v1/projects/:id`)
- [x] Implement list tasks in project (`GET /api/v1/projects/:id/tasks`)
- [x] Implement project statistics (`GET /api/v1/projects/:id/stats`)

---

### Phase 9: Task Management
- [x] Implement create task (`POST /api/v1/tasks`)
- [x] Implement list tasks with pagination, filter (`GET /api/v1/tasks`)
- [x] Implement get task details (`GET /api/v1/tasks/:id`)
- [x] Implement update task (`PATCH /api/v1/tasks/:id`)
- [x] Implement delete task (`DELETE /api/v1/tasks/:id`)
- [x] Implement assign task to employee (`POST /api/v1/tasks/:id/assign`)
- [x] Implement update task status — state machine (`PATCH /api/v1/tasks/:id/status`)
- [x] Implement get my assigned tasks (`GET /api/v1/tasks/my`)
- [x] Implement list submissions for task (`GET /api/v1/tasks/:id/submissions`)

---

### Phase 10: Work Submission & Approval
- [x] Implement submit completed work (`POST /api/v1/submissions`)
- [x] Implement list submissions with pagination (`GET /api/v1/submissions`)
- [x] Implement get submission details (`GET /api/v1/submissions/:id`)
- [x] Implement update submission (`PATCH /api/v1/submissions/:id`)
- [x] Implement get my submissions (`GET /api/v1/submissions/my`)
- [x] Implement approve submission — DB transaction (`POST /api/v1/submissions/:id/approve`)
- [x] Implement reject submission with reason (`POST /api/v1/submissions/:id/reject`)

---

### Phase 11: Payroll Management
- [x] Implement generate payroll (`POST /api/v1/payroll/generate`)
- [x] Implement list payroll records with pagination (`GET /api/v1/payroll`)
- [x] Implement get payroll details (`GET /api/v1/payroll/:id`)
- [x] Implement get my payroll (`GET /api/v1/payroll/my`)
- [x] Implement approve payroll (`POST /api/v1/payroll/:id/approve`)
- [x] Implement reject payroll (`POST /api/v1/payroll/:id/reject`)

---

### Phase 12: Payment Integration (Stripe)
- [x] Integrate Stripe SDK (`src/app/lib/stripe.ts`)
- [x] Implement create checkout session (`POST /api/v1/payments`)
- [x] Implement Stripe webhook handler (`POST /api/v1/payments/webhook`)
- [x] Implement list payments with pagination (`GET /api/v1/payments`)
- [x] Implement get payment details (`GET /api/v1/payments/:id`)
- [x] Implement get my payments (`GET /api/v1/payments/my`)

---

### Phase 13: Analytics & Audit
- [x] Implement role-based dashboard stats (`GET /api/v1/analytics/dashboard`)
- [x] Implement employee analytics (`GET /api/v1/analytics/employees`)
- [x] Implement project analytics (`GET /api/v1/analytics/projects`)
- [x] Implement payroll analytics (`GET /api/v1/analytics/payroll`)
- [x] Implement payment analytics (`GET /api/v1/analytics/payments`)
- [x] Implement list audit logs with pagination, filter (`GET /api/v1/audit-logs`)
- [x] Implement get audit log details (`GET /api/v1/audit-logs/:id`)

---

### Phase 14: App Setup, Security & Final Polish
- [x] Mount all routes in `src/app.ts` under `/api/v1/`
- [x] Create `src/server.ts` (connect DB + seed, start)
- [x] Add rate limiting (express-rate-limit)
- [x] Add helmet security headers
- [x] Verify all routes have auth + permission middleware
- [x] Verify org isolation on all queries
- [x] Implement soft deletes on major models (Role, Department, Project, Task)
- [ ] Postman collection **[TODO]**

---

### Phase 15: Soft Delete Implementation
- [x] Add `deletedAt DateTime?` to `role.prisma`
- [x] Add `deletedAt DateTime?` to `department.prisma`
- [x] Update `role.service.ts` to use soft delete
- [x] Update `department.service.ts` to use soft delete
- [x] Update `project.service.ts` to use soft delete
- [x] Update `task.service.ts` to use soft delete
- [x] Add `deletedAt: null` filter to all queries
- [x] Run prisma migration

---

## Git Commits (24 total)

| # | Commit Message | Status |
|---|---------------|--------|
| 1 | Project initialization & config setup | ✅ |
| 2 | Prisma schema — enums & core models | ✅ |
| 3 | Prisma schema — complete schema (all models) | ✅ |
| 4 | Core utilities (AppError, catchAsync, jwt, sendResponse) | ✅ |
| 5 | Prisma client & Redis client setup | ✅ |
| 6 | Middleware (auth, validation, error handler, notFound) | ✅ |
| 7 | Seed data — Default roles & permissions | ✅ |
| 8 | Auth module — Register, Login, Refresh, Logout, Me, Change Password | ✅ |
| 9 | Auth module — Google OAuth | ✅ |
| 10 | Organization module | ✅ |
| 11 | Role & Permission module | ✅ |
| 12 | Department module | ✅ |
| 13 | Employee module (with resend-credentials) | ✅ |
| 14 | Project module | ✅ |
| 15 | Task module (with status transitions) | ✅ |
| 16 | Work Submission module (with approval transaction) | ✅ |
| 17 | Employee status checks (INACTIVE/SUSPENDED/TERMINATED) | ✅ |
| 18 | Employee status utility extraction | ✅ |
| 19 | Payroll module | ✅ |
| 20 | Payment module — Stripe integration | ✅ |
| 21 | Analytics module | ✅ |
| 22 | Audit Log module with full logging | ✅ |
| 23 | Fix duplicate endpoints & routing bugs | ✅ |
| 24 | Security hardening — Rate limiting & Helmet | ✅ |
| 25 | Soft delete implementation | ✅ |

---

## Summary: Completed vs Remaining

### ✅ Completed (90%)
| Category | Status |
|----------|--------|
| API Design & Documentation | ✅ (except Postman) |
| Database Design & Schema | ✅ |
| Authentication & Authorization | ✅ |
| Core Functionality & Business Logic | ✅ |
| Error Handling & Validation | ✅ |
| Payment Integration | ✅ |
| Performance & Code Quality | ✅ |
| Commit History | ✅ (25 commits) |
| Soft Delete Implementation | ✅ |
| Security (Rate Limiting, Helmet) | ✅ |

### ❌ Remaining (10%)
| Task | Priority | Notes |
|------|----------|-------|
| Deployment (Vercel/Render) | HIGH | Need to deploy to production |
| Postman Collection | HIGH | Document all 76 endpoints |
| Video Explanation | HIGH | 5-10 minute API walkthrough |
| Environment Configuration | MEDIUM | Set up production env vars |
| DB Connection (Production) | MEDIUM | Configure production database |

---

## Implemented Features

### Auth (8 endpoints)
- Register (creates company + admin user)
- Login (email + password)
- Google OAuth (auto-links by email)
- Refresh token
- Logout
- Get current user (GET /me)
- Change password (with mustChangePassword flag)
- Upload avatar (Cloudinary)

### Organization (4 endpoints)
- Get my organization
- Get organization by ID
- Update organization
- Organization stats

### Roles & Permissions (9 endpoints)
- CRUD for roles (system roles are templates, copied on org creation)
- 38 permissions across all modules
- Assign/remove permissions to roles

### Departments (6 endpoints)
- CRUD with org isolation
- List employees in department

### Employees (7 endpoints)
- CRUD with org isolation
- Employee status management (ACTIVE, INACTIVE, SUSPENDED, TERMINATED)
- Resend credentials
- Employee stats

### Projects (7 endpoints)
- CRUD with org isolation
- Project stats
- List tasks in project

### Tasks (9 endpoints)
- CRUD with org isolation
- Assign to single employee (status check: can't assign to SUSPENDED/TERMINATED)
- Status transitions: TODO→IN_PROGRESS→SUBMITTED→APPROVED→COMPLETED, REJECTED→IN_PROGRESS
- Delete only TODO or COMPLETED tasks
- List my tasks
- List submissions for task

### Submissions (7 endpoints)
- CRUD with org isolation
- Submit work (status check: must be ACTIVE)
- Approve/Reject with DB transaction (creates payroll record on approve)
- Status flow: PENDING→APPROVED|REJECTED

### Payroll (6 endpoints)
- Generate from approved submissions (single or batch)
- DRAFT (manual) + GENERATED (auto) status flow
- APPROVE/REJECT endpoints
- Decimal formatting for API responses

### Payments (5 endpoints)
- Stripe checkout session creation
- Webhook handling (checkout.session.completed → PAID)
- List payments, get my payments, get by ID

### Analytics (5 endpoints)
- Role-based dashboard (Admin/HR sees org stats, Employee sees personal stats)
- Employee analytics, project analytics, payroll analytics, payment analytics

### Audit Logs (2 endpoints)
- Automatic logging on all key actions (28 action types)
- Fire-and-forget utility (never blocks main transaction)
- Filterable by user, action, entity, date range

### Security
- Rate limiting (100 req/15 min general, 20 req/15 min auth)
- Helmet security headers
- JWT authentication on all protected routes
- Org isolation on all queries
- Soft deletes on Role, Department, Project, Task

---

## Notes & Guidelines
1. **Preserve Coding Style**: Follow the style established in `PH-Healthcare-Backend` (Modular file layout, route-controller-service separation, catchAsync, sendResponse, AppError patterns).
2. **Prisma Client**: Generated at `generated/prisma` to avoid polluting default imports.
3. **Response Format**: `{ success, statusCode, message, data, meta }`
4. **Each Module**: Has `*.controller.ts`, `*.service.ts`, `*.route.ts`, `*.validation.ts`, `*.interface.ts`
5. **Git Commits**: Created manually by user, agent only makes file changes
6. **IDs**: Use `@default(uuid())` not cuid
7. **Seed**: Runs once (checks count > 0 to skip)
8. **Validation Errors**: Comma-joined message string for UI toast + structured data array for field-level display
9. **Decimal Fields**: Prisma Decimal → `toNumber()` before API response
10. **Employee Status**: Shared utility in `employeeStatus.ts` enforced across task & submission services
11. **Soft Delete**: Use `deletedAt` timestamp instead of hard delete for Role, Department, Project, Task
