# Architecture

## Project Structure

```
EmNex-Backend/
├── prisma/
│   ├── migrations/              # Database migrations
│   └── schema/                  # Multi-file Prisma schema
│       ├── schema.prisma        # Base (generator + datasource)
│       ├── enums.prisma         # All enums
│       ├── organization.prisma  # Organization model
│       ├── user.prisma          # User model
│       ├── role.prisma          # Role model
│       ├── permission.prisma    # Permission model
│       ├── role-permission.prisma # RolePermission junction
│       ├── department.prisma    # Department model
│       ├── employee.prisma      # Employee model
│       ├── project.prisma       # Project model
│       ├── task.prisma          # Task model
│       ├── work-submission.prisma # WorkSubmission model
│       ├── payroll.prisma       # Payroll model
│       ├── payment.prisma       # Payment model
│       └── audit-log.prisma     # AuditLog model
├── src/
│   ├── app/
│   │   ├── config/
│   │   │   └── index.ts         # Environment variables
│   │   ├── interfaces/
│   │   │   └── index.ts         # IRequestUser + Express augmentation
│   │   ├── lib/
│   │   │   ├── prisma.ts        # Prisma client singleton
│   │   │   ├── stripe.ts        # Stripe instance
│   │   │   ├── cloudinary.ts    # Cloudinary config
│   │   │   ├── multer.ts        # File upload config
│   │   │   ├── nodemailer.ts    # Email transporter
│   │   │   ├── email.ts         # Email sending functions
│   │   │   └── googleAuth.ts    # Google OAuth client
│   │   ├── middleware/
│   │   │   ├── checkAuth.ts     # JWT authentication
│   │   │   ├── checkPermission.ts # RBAC authorization
│   │   │   ├── validateRequest.ts # Zod validation
│   │   │   ├── globalErrorHandler.ts # Error handler
│   │   │   └── notFound.ts      # 404 handler
│   │   ├── module/              # Feature modules
│   │   │   ├── auth/            # Authentication
│   │   │   ├── organization/    # Organization management
│   │   │   ├── role/            # Role management
│   │   │   ├── department/      # Department management
│   │   │   ├── employee/        # Employee management
│   │   │   ├── project/         # Project management
│   │   │   ├── task/            # Task management
│   │   │   ├── submission/      # Work submissions
│   │   │   ├── payroll/         # Payroll generation
│   │   │   ├── payment/         # Stripe payments
│   │   │   ├── analytics/       # Dashboard analytics
│   │   │   └── audit-log/       # Audit logging
│   │   └── templates/
│   │       └── employee-welcome-email.ejs
│   ├── app.ts                   # Express app setup
│   └── server.ts                # Server entry point
├── package.json
├── tsconfig.json
├── biome.json
├── README.md
├── ARCHITECTURE.md
├── DATABASE.md
├── API_INTEGRATION.md
├── todo.md
├── workflow.md
└── assignment.md
```

## Module Pattern

Each feature module follows a consistent 5-file pattern:

```
module/
└── feature/
    ├── feature.controller.ts    # Request handling
    ├── feature.service.ts       # Business logic
    ├── feature.route.ts         # Route definitions
    ├── feature.validation.ts    # Zod schemas
    └── feature.interface.ts     # TypeScript types
```

### Flow

```
Request → Route → Middleware(auth, permission, validation) → Controller → Service → Prisma → Response
```

### Controller Responsibilities
- Extract user from `req.user`
- Extract params/body/query from request
- Call service function
- Send standardized response via `sendResponse()`

### Service Responsibilities
- Business logic and data operations
- Input validation beyond schema (ownership, status checks)
- Audit logging via `createAuditLog()`
- Throwing `AppError` on business rule violations

---

## Middleware

### Global Middleware (applied in `app.ts`)

| Middleware | Purpose |
|-----------|---------|
| `helmet()` | Security headers |
| `rateLimit()` | 100 req/15min per IP |
| `cors()` | Cross-origin requests |
| `express.json()` | JSON body parsing |
| `cookieParser()` | Cookie parsing |

### Route-Level Middleware

| Middleware | Purpose |
|-----------|---------|
| `auth()` | JWT verification, user loading, status checks |
| `checkPermission(...perms)` | RBAC permission check |
| `validateRequest(schema)` | Zod input validation |

### Authentication Flow (`auth()`)

```
1. Extract token from cookie or Authorization header
2. Verify JWT signature
3. Check if token is blacklisted (if Redis enabled)
4. Fetch user from DB with role + permissions
5. Check user status (BLOCKED, DELETED)
6. Check employee status (TERMINATED)
7. Attach req.user = { userId, email, name, role, organizationId, permissions }
8. Call next()
```

### Authorization Flow (`checkPermission()`)

```
1. Read req.user.permissions (loaded by auth())
2. Check if all required permissions exist in user's permissions
3. If missing any → throw 403 with missing permission names
4. If all present → call next()
```

---

## Utilities

| Utility | Purpose |
|---------|---------|
| `catchAsync(fn)` | Wraps async route handlers, catches errors → `next(error)` |
| `AppError(statusCode, message)` | Custom error class with HTTP status code |
| `sendResponse(res, { statusCode, success, message, data, meta })` | Standardized JSON response |
| `jwtUtils.createToken()` / `verifyToken()` | JWT sign/verify operations |
| `createAuditLog(data)` | Creates audit log record (fire-and-forget) |
| `seed()` | Seeds permissions + system roles on first run |

---

## Response Format

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource fetched successfully",
  "data": { ... }
}
```

### Success with Pagination

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resources fetched successfully",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### Error

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errorDetails": [
    { "field": "email", "message": "Invalid email" }
  ]
}
```

---

## Error Handling

The `globalErrorHandler` middleware handles:

| Error Type | HTTP Status |
|-----------|-------------|
| `AppError` | Uses error's `statusCode` |
| `PrismaClientValidationError` | 400 |
| Prisma `P2002` (Unique constraint) | 400 |
| Prisma `P2003` (Foreign key) | 400 |
| Prisma `P2025` (Record not found) | 400 |
| Prisma `P1000` (Auth failed) | 401 |
| Prisma `P1001` (DB unreachable) | 400 |
| Generic `Error` | 500 |

---

## Audit Logging

Every significant action creates an audit log record:

```typescript
createAuditLog({
  user: { userId, organizationId },
  action: AuditAction.CREATE_EMPLOYEE,
  entity: "Employee",
  entityId: employee.id,
  metadata: { name, email },
  ipAddress: req.ip,
});
```

### 27 Audit Actions

| Category | Actions |
|----------|---------|
| Auth | `LOGIN`, `LOGIN_FAILED`, `GOOGLE_LOGIN`, `LOGOUT`, `PASSWORD_CHANGED` |
| Employee | `CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`, `DELETE_EMPLOYEE`, `CHANGE_EMPLOYEE_ROLE`, `CHANGE_EMPLOYEE_STATUS` |
| Department | `CREATE_DEPARTMENT`, `UPDATE_DEPARTMENT`, `DELETE_DEPARTMENT` |
| Role | `CREATE_ROLE`, `UPDATE_ROLE`, `DELETE_ROLE`, `ASSIGN_PERMISSIONS` |
| Project | `CREATE_PROJECT`, `UPDATE_PROJECT`, `DELETE_PROJECT`, `CHANGE_PROJECT_STATUS` |
| Task | `CREATE_TASK`, `ASSIGN_TASK`, `CHANGE_TASK_STATUS`, `DELETE_TASK` |
| Submission | `SUBMIT_WORK`, `APPROVE_WORK`, `REJECT_WORK` |
| Payroll | `GENERATE_PAYROLL`, `APPROVE_PAYROLL`, `REJECT_PAYROLL` |
| Payment | `PAYMENT_INITIATED`, `PAYMENT_COMPLETED`, `PAYMENT_FAILED` |
