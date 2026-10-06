# API reference

Every EmNex endpoint: what it needs, what it returns, and the conventions shared by all of them.

[← Back to README](./README.md) · Try it in Postman: [`EmNex Backend.postman_collection.json`](./EmNex%20Backend.postman_collection.json)

---

## Contents

- [Conventions](#conventions)
- [Endpoints](#endpoints) — [Auth](#auth) · [Organization](#organization) · [Roles](#roles-and-permissions) · [Departments](#departments) · [Employees](#employees) · [Projects](#projects) · [Tasks](#tasks) · [Work hours](#work-hours-submissions) · [Payroll](#payroll) · [Payments](#payments) · [Analytics](#analytics) · [Audit log](#audit-log)
- [Worked examples](#worked-examples)

---

## Conventions

### Base URL

| Environment | URL |
| :--- | :--- |
| Local | `http://localhost:5000/api/v1` |
| Production | `https://emnex-api.vercel.app/api/v1` |

`GET /` (outside `/api/v1`) is a health check: `{ "success": true, "message": "Welcome to EmNex System Backend" }`.

### Authentication

Send **either**:

- the `accessToken` cookie (set automatically by login — browsers must send requests with credentials), **or**
- `Authorization: Bearer <accessToken>` (Postman, scripts).

Write requests use `Content-Type: application/json`, except the avatar upload (`multipart/form-data`) and the Stripe webhook (raw JSON).

### Success response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tasks fetched successfully",
  "data": [ ],
  "meta": { "page": 1, "limit": 10, "total": 23, "totalPages": 3 }
}
```

- **Paginated lists** (`/employees`, `/projects`, `/tasks`, `/submissions`, `/payroll`, `/payments`, `/audit-logs`) return an array in `data` plus `meta`. Query with `?page=` and `?limit=` (default 10; audit log 20).
- **Unpaginated lists** (`/departments`, `/roles`, every `/my` endpoint, the `/options` endpoints) return a plain array and no `meta`.

### Error response

```json
{ "success": false, "statusCode": 403, "message": "Cannot approve your own submission" }
```

Validation failures (400) also list each field:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Hours worked must be positive",
  "data": [{ "field": "hoursWorked", "message": "Hours worked must be positive" }]
}
```

| Status | Meaning in EmNex |
| :---: | :--- |
| 200 / 201 | OK / created |
| 400 | Invalid input or a business rule (e.g. "Cannot transition from TODO to APPROVED") |
| 401 | Not logged in, token expired or revoked, wrong password |
| 403 | Missing permission, another organization's data, or a self-action guard |
| 404 | Not found (including unknown routes: `"Route not found"`) |
| 409 | Conflict — duplicate email/slug/payroll, overlapping payroll, already paid |
| 429 | Rate limited (300 req / 15 min per user, or per IP when anonymous; 20 / 15 min per email on login, register and change-password) |
| 500 | Server error |

### Data formats

- **IDs** are UUIDs. Malformed IDs return 4xx, never 500.
- **Dates** are ISO 8601 UTC strings, e.g. `2026-10-01T00:00:00.000Z`. Due dates and work dates are stored as UTC midnight.
- **Money and hours** — payroll and payment amounts are numbers; other `Decimal` fields (`hoursWorked`, `estimatedHours`, `budget`, `salary`, `hourlyRate`) are returned as **strings** such as `"6"` or `"36.5"` — parse them before doing math.
- **Permissions** below show what the route requires. "`a` · `b`" means **all** of them; "`a` \| `b`" means **any one**. 🔓 = no login required, 🔑 = any logged-in user.

---

## Endpoints

### Auth

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | 🔓 | Create an organization + its admin. Sets cookies |
| POST | `/auth/login` | 🔓 | Sets cookies; returns `{ accessToken, refreshToken, user }` |
| POST | `/auth/google` | 🔓 | `{ idToken }` from Google. Existing accounts only |
| POST | `/auth/refresh-token` | 🔓 + `refreshToken` cookie | New token pair |
| GET | `/auth/me` | 🔑 | Current user with `organization`, `role`, `permissions[]`, `employeeId` (or `null`) |
| POST | `/auth/change-password` | 🔑 | Revokes all other sessions; returns new tokens |
| POST | `/auth/logout` | 🔑 | Clears cookies |
| POST | `/auth/upload-avatar` | 🔑 | `multipart/form-data`, field `avatar`; JPEG/PNG/WebP ≤ 5 MB |

**Bodies**

```jsonc
// POST /auth/register
{
  "organizationName": "Acme Inc",          // ≥ 2 chars
  "organizationSlug": "acme",              // lowercase letters, numbers, hyphens
  "name": "Jane Admin",                    // 2–150
  "email": "jane@acme.com",
  "password": "Str0ng!pass"                // ≥ 8, upper + lower + number + symbol
}

// POST /auth/login
{ "email": "admin@emnex.com", "password": "EmnexAdmin123!" }

// POST /auth/change-password
{ "currentPassword": "…", "newPassword": "…" }   // same strength rules; must differ
```

### Organization

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/organizations/me` | 🔑 | Your organization |
| GET | `/organizations/:id` | `organization.view` | Your own organization only |
| PATCH | `/organizations/:id` | `organization.update` | `{ name?, slug? }` — slug unique, lowercase/numbers/hyphens |
| GET | `/organizations/:id/stats` | `organization.view` | Counts of users, departments, employees, and total / active / completed projects |

### Roles and permissions

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/roles` | `role.view` | Roles in your organization |
| GET | `/roles/:id` | `role.view` | Role with its permissions |
| POST | `/roles` | `role.create` | Custom role. You can only grant permissions you hold |
| PATCH | `/roles/:id` | `role.update` | `{ name?, description? }` — not built-in roles, not roles in use (rename) |
| DELETE | `/roles/:id` | `role.delete` | Soft delete — not built-in roles, not roles in use |
| GET | `/roles/permissions/all` | `permission.view` | The 44 permissions (`id`, `name`) |
| GET | `/roles/:roleId/permissions` | `permission.view` | |
| POST | `/roles/:roleId/permissions` | `permission.assign` | **Replaces** the role's permissions with `permissionIds`. Not your own role |
| DELETE | `/roles/:roleId/permissions/:permissionId` | `permission.assign` | Remove one. Not your own role |
| POST | `/roles/:roleId/reset-permissions` | `permission.assign` | Built-in roles only: restore the default set. Not your own role |

```jsonc
// POST /roles
{
  "name": "Team Lead",                       // 2–50, unique in the org
  "description": "Assigns and reviews work", // ≤ 200, optional
  "permissionIds": ["<uuid>", "<uuid>"]      // ≥ 1; "manage" permissions auto-add the module's .view
}

// POST /roles/:roleId/permissions
{ "permissionIds": ["<uuid>", "<uuid>"] }
```

### Departments

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/departments` | `department.view` | Not paginated |
| GET | `/departments/:id` | `department.view` | |
| GET | `/departments/:id/employees` | `department.view` | |
| POST | `/departments` | `department.create` | `{ name (2–100), description? (≤ 500) }`. Re-creating a deleted name restores it |
| PATCH | `/departments/:id` | `department.update` | Same fields, optional |
| DELETE | `/departments/:id` | `department.delete` | Soft delete; blocked while employees are assigned |

### Employees

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/employees` | `employee.view` | Paginated. `search` (name, email, code, job title), `departmentId`, `status`, `sortBy`, `sortOrder` |
| GET | `/employees/options` | `employee.view` \| `task.assign` \| `task.create` | Lightweight list for pickers |
| GET | `/employees/:id` | `employee.view` | |
| GET | `/employees/:id/stats` | `employee.view` | Tasks (total / completed), work logs (total / approved), payrolls (total / paid), payments |
| POST | `/employees` | `employee.create` | Creates user + employee, emails a temporary password. Returns `{ employee, temporaryPassword }` |
| PATCH | `/employees/:id` | `employee.update` | Status `TERMINATED` also needs `employee.delete`; `roleId` also needs `role.update` |
| DELETE | `/employees/:id` | `employee.delete` | Terminates (status → `TERMINATED`) |
| POST | `/employees/:id/resend-credentials` | `employee.create` | New temporary password (emailed and returned); old one stops working |

```jsonc
// POST /employees
{
  "name": "Sarah Jenkins",                   // 2–100
  "email": "sarah@acme.com",                 // unique platform-wide
  "roleId": "<uuid>",                        // you must hold all of this role's permissions
  "departmentId": "<uuid>",                  // optional
  "jobTitle": "Frontend Engineer",           // 2–100
  "salaryType": "MONTHLY",                   // or "HOURLY"
  "salary": 6500,                            // for MONTHLY
  "hourlyRate": 40,                          // for HOURLY
  "joiningDate": "2026-10-01T00:00:00.000Z"
}

// PATCH /employees/:id — every field optional
{ "departmentId": "<uuid>", "jobTitle": "…", "salaryType": "HOURLY", "salary": 0, "hourlyRate": 45,
  "status": "SUSPENDED", "roleId": "<uuid>" }
```

### Projects

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/projects` | `project.view` | Paginated. `search`, `status` |
| GET | `/projects/options` | `project.view` \| `task.create` | `[{ id, name, status }]` for pickers |
| GET | `/projects/:id` | `project.view` | Includes its tasks |
| GET | `/projects/:id/tasks` | `project.view` · `task.view` | |
| GET | `/projects/:id/stats` | `project.view` | Tasks (total / to do / in progress / completed), work logs (total / approved) |
| POST | `/projects` | `project.create` | |
| PATCH | `/projects/:id` | `project.update` | Also changes `status` |
| DELETE | `/projects/:id` | `project.delete` | Soft delete; blocked while tasks are active |

```jsonc
// POST /projects   (PATCH: same fields, all optional, plus "status")
{
  "name": "Website Redesign",                // 2–200
  "description": "…",                        // ≤ 2000, optional
  "startDate": "2026-10-01T00:00:00.000Z",   // optional
  "endDate": "2026-12-31T00:00:00.000Z",     // optional, not before startDate
  "budget": 25000                            // optional, > 0
}
```

### Tasks

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/tasks` | `task.view` | Paginated. `search`, `status`, `priority`, `projectId`, `employeeId` |
| GET | `/tasks/my` | `task.view_own` | Your tasks (needs an employee record) |
| GET | `/tasks/:id` | `task.view` | |
| GET | `/tasks/:id/submissions` | `task.view_own` \| `task.view` | Hours logged on the task (own task only with `_own`) |
| POST | `/tasks` | `task.create` | Project must be open; assignee `ACTIVE` and able to work tasks |
| PATCH | `/tasks/:id` | `task.update` | Title, description, estimate, priority, due date |
| PATCH | `/tasks/:id/status` | `task.update_own` \| `task.update` | `{ status }` — see [task flow](./WORKFLOW.md#tasks) |
| POST | `/tasks/:id/assign` | `task.assign` | `{ employeeId }` — same checks as create |
| DELETE | `/tasks/:id` | `task.delete` | Soft delete; only `TODO`/`COMPLETED` tasks with no hours logged |

```jsonc
// POST /tasks   (PATCH /tasks/:id: same minus projectId/employeeId, all optional)
{
  "projectId": "<uuid>",
  "employeeId": "<uuid>",                    // the assignee
  "title": "Build the pricing page",         // 2–200
  "description": "…",                        // ≤ 5000, optional
  "estimatedHours": 8,                       // optional, > 0
  "priority": "HIGH",                        // LOW | MEDIUM (default) | HIGH | URGENT
  "dueDate": "2026-10-20T00:00:00.000Z"      // optional
}

// PATCH /tasks/:id/status
{ "status": "IN_PROGRESS" }   // TODO | IN_PROGRESS | SUBMITTED | APPROVED | REJECTED | COMPLETED
```

### Work hours (submissions)

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/submissions` | `submission.view` \| `payroll.view` \| `payroll.generate` | Paginated. `status`, `taskId`, `employeeId`, `sortOrder` |
| GET | `/submissions/my` | `submission.view_own` | Your logs, with task and project |
| GET | `/submissions/:id` | `submission.view_own` \| `submission.view` | |
| POST | `/submissions` | `submission.create` | Log hours on your own task |
| PATCH | `/submissions/:id` | `submission.update` | Your own, `PENDING` only |
| POST | `/submissions/:id/approve` | `submission.approve` | Not your own; `PENDING` only |
| POST | `/submissions/:id/reject` | `submission.reject` | `{ reason }`; not your own; `PENDING` only |

```jsonc
// POST /submissions   (PATCH: description / hoursWorked / workDate, all optional)
{
  "taskId": "<uuid>",
  "description": "Built the responsive header",  // 10–5000
  "hoursWorked": 2.5,                             // > 0, ≤ 24, and ≤ 24 per day in total
  "workDate": "2026-10-06T00:00:00.000Z"          // not in the future
}

// POST /submissions/:id/reject
{ "reason": "Please split this across the days you worked" }   // 10–500
```

### Payroll

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/payroll` | `payroll.view` | Paginated. `status`, `employeeId` |
| GET | `/payroll/my` | `payroll.view_own` | Your payslips, with payment |
| GET | `/payroll/:id` | `payroll.view` \| `payroll.view_own` | Your own only with `_own` |
| POST | `/payroll/generate` | `payroll.generate` | Creates a `DRAFT`. Not for yourself |
| POST | `/payroll/:id/approve` | `payroll.approve` | `DRAFT` → `APPROVED`. Not your own |
| POST | `/payroll/:id/reject` | `payroll.reject` | `DRAFT` → `REJECTED` (the period can then be generated again) |

```jsonc
// POST /payroll/generate
{
  "employeeId": "<uuid>",
  "periodStart": "2026-09-01T00:00:00.000Z",
  "periodEnd": "2026-09-30T23:59:59.999Z",
  "deductions": 320,     // optional, ≥ 0, ≤ gross
  "extraAmount": 500     // optional, > 0 — ADDED to the calculated pay (bonus, PTO, 0-hours payment)
}
```

Gross = (monthly salary **or** approved hours in the period × hourly rate) **+** `extraAmount`. Net = gross − deductions. Full rules: [WORKFLOW → Payroll](./WORKFLOW.md#payroll).

### Payments

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/payments` | `payment.create` | `{ payrollId, currency? }` → Stripe Checkout URL. Approved payroll only; not your own |
| GET | `/payments/verify/:sessionId` | `payment.view` | Called from the success page; completes the payment if Stripe says it's paid |
| GET | `/payments` | `payment.view` | Paginated. `status`, `employeeId` |
| GET | `/payments/my` | `payment.view_own` | Your payouts |
| GET | `/payments/:id` | `payment.view` | |
| POST | `/payments/webhook` | 🔓 Stripe signature | Raw body. Handles `checkout.session.completed`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed` |

### Analytics

| Method | Path | Access | Returns |
| :--- | :--- | :--- | :--- |
| GET | `/analytics/dashboard` | `analytics.view` | A summary chosen by built-in role name — **admin**: employees, active projects, pending reviews, payroll and payment totals; **HR**: headcount, departments, new hires, pending reviews and hours; **finance**: payroll by stage and payment counts; **any other role**: their own tasks and hours |
| GET | `/analytics/employees` | `analytics.view` \| `employee.view` | `byStatus`, `byDepartment`, `recentHires` |
| GET | `/analytics/projects` | `analytics.view` \| `project.view` | `byStatus`, `totalProjects`, `avgTasksPerProject`, `recentProjects` |
| GET | `/analytics/payroll` | `analytics.view` \| `payroll.view` | `byStatus`, `totals`, `monthlyTrend` (rejected excluded) |
| GET | `/analytics/payments` | `analytics.view` \| `payment.view` | `byStatus`, `completed`, `byGateway` |

Analytics return aggregates only — never one person's pay.

### Audit log

| Method | Path | Access | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/audit-logs` | `audit.view` | Paginated (default 20). `action`, `entity`, `userId` |
| GET | `/audit-logs/:id` | `audit.view` | |

---

## Worked examples

### Log in and read the current user

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "employee@emnex.com", "password": "EmnexEmployee123!" }
```

```jsonc
// 200 — also sets the accessToken and refreshToken cookies
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully",
  "data": {
    "accessToken": "eyJhbGciOi…",
    "refreshToken": "eyJhbGciOi…",
    "user": {
      "id": "d1f…", "name": "Demo Employee", "email": "employee@emnex.com",
      "role": "EMPLOYEE", "organizationId": "8265…", "mustChangePassword": false
    }
  }
}
```

```http
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOi…
```

```jsonc
// 200
{
  "success": true,
  "statusCode": 200,
  "message": "User profile fetched successfully",
  "data": {
    "id": "d1f…", "name": "Demo Employee", "email": "employee@emnex.com",
    "status": "ACTIVE", "mustChangePassword": false,
    "organization": { "id": "8265…", "name": "EmNex Demo", "slug": "emnex-demo" },
    "role": { "id": "…", "name": "EMPLOYEE", "description": "Regular employee" },
    "permissions": ["task.view_own", "task.update_own", "submission.view_own", "submission.create",
                    "submission.update", "payroll.view_own", "payment.view_own"],
    "employeeId": "d430…"
  }
}
```

### Assign a task, start it, log hours, get them approved

```http
POST /api/v1/tasks                         (admin — task.create)
{ "projectId": "a54a…", "employeeId": "d430…", "title": "Build the pricing page",
  "estimatedHours": 8, "priority": "HIGH" }
→ 201  data.status = "TODO"

PATCH /api/v1/tasks/<taskId>/status        (employee — task.update_own)
{ "status": "IN_PROGRESS" }
→ 200

POST /api/v1/submissions                   (employee — submission.create)
{ "taskId": "<taskId>", "description": "Built the layout and pricing cards",
  "hoursWorked": 3, "workDate": "2026-10-06T00:00:00.000Z" }
→ 201  data.status = "PENDING"

POST /api/v1/submissions/<id>/approve      (HR — submission.approve, not the employee)
→ 200  data.status = "APPROVED"
```

Approving your own log instead:

```json
{ "success": false, "statusCode": 403, "message": "Cannot approve your own submission" }
```

### Generate payroll with a bonus, then pay it

```http
POST /api/v1/payroll/generate              (finance — payroll.generate)
{ "employeeId": "d430…", "periodStart": "2026-09-01T00:00:00.000Z",
  "periodEnd": "2026-09-30T23:59:59.999Z", "extraAmount": 250, "deductions": 100 }
```

```jsonc
// 201 — monthly salary 4000 + 250 extra − 100 deductions
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "f2c…", "status": "DRAFT",
    "grossAmount": 4250, "deductions": 100, "netAmount": 4150,
    "periodStart": "2026-09-01T00:00:00.000Z", "periodEnd": "2026-09-30T23:59:59.999Z",
    "employee": { "user": { "name": "Demo Employee", "email": "employee@emnex.com" } }
  }
}
```

```http
POST /api/v1/payroll/<id>/approve          (finance — payroll.approve)
→ 200  data.status = "APPROVED"

POST /api/v1/payments                      (finance — payment.create)
{ "payrollId": "<id>" }
→ 200  { "data": { "url": "https://checkout.stripe.com/c/pay/cs_test_…", … } }
```

Open the `url`, pay with `4242 4242 4242 4242`. Stripe redirects to `APP_URL/payment/success?session_id=cs_test_…`, and the page calls:

```http
GET /api/v1/payments/verify/cs_test_…      (finance — payment.view)
→ 200  data.status = "paid"   — Payment COMPLETED, Payroll PAID
```

Trying to pay it again returns `409 "This payroll has already been paid"`.

[← Back to README](./README.md)
