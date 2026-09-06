# API Integration Guide

**Base URL**: `http://localhost:5000/api/v1`

**Content-Type**: `application/json`

**Authentication**: JWT via cookies (`accessToken`) or `Authorization: Bearer <token>` header

---

## Table of Contents

- [Global](#global)
- [Authentication](#authentication-auth)
- [Organization](#organization-organizations)
- [Roles & Permissions](#roles--permissions-roles)
- [Departments](#departments-departments)
- [Employees](#employees-employees)
- [Projects](#projects-projects)
- [Tasks](#tasks-tasks)
- [Work Submissions](#work-submissions-submissions)
- [Payroll](#payroll-payroll)
- [Payments](#payments-payments)
- [Audit Logs](#audit-logs-audit-logs)
- [Analytics](#analytics-analytics)
- [Error Handling](#error-handling)
- [Pagination](#pagination)

---

## Global

### `GET /`

Health check endpoint.

**Response**:
```json
{
  "success": true,
  "message": "Welcome to EmNex System Backend"
}
```

---

## Authentication (`/auth`)

Rate limit: 20 requests per 15 minutes.

### `POST /auth/register`

Register a new organization with an admin user.

**Body**:
```json
{
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp",
  "name": "John Admin",
  "email": "admin@acme.com",
  "password": "SecureP@ss1"
}
```

**Validation Rules**:
- `organizationName`: string, min 2 chars
- `organizationSlug`: string, min 2, regex `^[a-z0-9-]+$`
- `name`: string, 2-150 chars
- `email`: valid email
- `password`: min 8, must have lowercase, uppercase, number, special char

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Organization registered successfully",
  "data": {
    "organization": { "id": "...", "name": "Acme Corp", "slug": "acme-corp" },
    "user": { "id": "...", "name": "John Admin", "email": "admin@acme.com", "role": "ADMIN" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Cookies Set**: `accessToken` (24h), `refreshToken` (7d)

---

### `POST /auth/login`

Login with email and password.

**Body**:
```json
{
  "email": "admin@acme.com",
  "password": "SecureP@ss1"
}
```

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "...",
      "name": "John Admin",
      "email": "admin@acme.com",
      "role": "ADMIN",
      "organizationId": "...",
      "mustChangePassword": false
    }
  }
}
```

---

### `GET /auth/me`

Get current authenticated user profile.

**Auth**: Required

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile fetched successfully",
  "data": {
    "id": "...",
    "name": "John Admin",
    "email": "admin@acme.com",
    "role": "ADMIN",
    "organizationId": "...",
    "organization": { "id": "...", "name": "Acme Corp" }
  }
}
```

---

### `POST /auth/refresh-token`

Get new access token using refresh token.

**Body** (cookie): `refreshToken`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### `POST /auth/change-password`

Change current password.

**Auth**: Required

**Body**:
```json
{
  "currentPassword": "OldP@ss1",
  "newPassword": "NewP@ss1"
}
```

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "data": null
}
```

---

### `POST /auth/logout`

Logout and clear tokens.

**Auth**: Required

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null
}
```

---

### `POST /auth/upload-avatar`

Upload user avatar image.

**Auth**: Required

**Content-Type**: `multipart/form-data`

**Body**: `avatar` (file) — JPEG, PNG, or WebP, max 10MB

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatar": "https://res.cloudinary.com/..."
  }
}
```

---

### `POST /auth/google`

Login with Google OAuth.

**Body**:
```json
{
  "idToken": "google-id-token-string"
}
```

**Response** (200): Same as login response.

---

## Organization (`/organizations`)

### `GET /organizations/me`

Get current user's organization.

**Auth**: Required

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Organization fetched successfully",
  "data": {
    "id": "...",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### `GET /organizations/:id`

Get organization by ID.

**Auth**: Required  
**Permission**: `organization.view`

**Response** (200): Same as above.

---

### `PATCH /organizations/:id`

Update organization details.

**Auth**: Required  
**Permission**: `organization.update`

**Body**:
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp"
}
```

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Organization updated successfully",
  "data": { "id": "...", "name": "Acme Corporation", "slug": "acme-corp" }
}
```

---

### `GET /organizations/:id/stats`

Get organization statistics.

**Auth**: Required  
**Permission**: `organization.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Organization stats fetched successfully",
  "data": {
    "totalEmployees": 25,
    "totalDepartments": 5,
    "totalProjects": 12,
    "activeProjects": 8
  }
}
```

---

## Roles & Permissions (`/roles`)

### `POST /roles`

Create a new role.

**Auth**: Required  
**Permission**: `role.create`

**Body**:
```json
{
  "name": "Team Lead",
  "description": "Team leadership role"
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Role created successfully",
  "data": {
    "id": "...",
    "name": "Team Lead",
    "description": "Team leadership role",
    "isSystem": false,
    "organizationId": "..."
  }
}
```

---

### `GET /roles`

Get all roles in organization.

**Auth**: Required  
**Permission**: `role.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Roles fetched successfully",
  "data": [
    { "id": "...", "name": "ADMIN", "isSystem": true, "userCount": 3 },
    { "id": "...", "name": "HR_MANAGER", "isSystem": true, "userCount": 2 },
    { "id": "...", "name": "Team Lead", "isSystem": false, "userCount": 5 }
  ]
}
```

---

### `GET /roles/permissions/all`

Get all available permissions.

**Auth**: Required  
**Permission**: `permission.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Permissions fetched successfully",
  "data": [
    { "id": "...", "name": "employee.view", "description": "View employees" },
    { "id": "...", "name": "employee.create", "description": "Create employees" }
  ]
}
```

---

### `GET /roles/:id`

Get role by ID with its permissions.

**Auth**: Required  
**Permission**: `role.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Role fetched successfully",
  "data": {
    "id": "...",
    "name": "Team Lead",
    "permissions": [
      { "id": "...", "name": "employee.view" },
      { "id": "...", "name": "project.view" }
    ]
  }
}
```

---

### `PATCH /roles/:id`

Update role name/description.

**Auth**: Required  
**Permission**: `role.update`

**Body**:
```json
{
  "name": "Senior Team Lead",
  "description": "Senior leadership role"
}
```

**Restrictions**: Cannot rename system roles or roles assigned to users.

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Role updated successfully",
  "data": { "id": "...", "name": "Senior Team Lead" }
}
```

---

### `DELETE /roles/:id`

Soft delete a role.

**Auth**: Required  
**Permission**: `role.delete`

**Restrictions**: Cannot delete system roles.

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Role deleted successfully",
  "data": null
}
```

---

### `GET /roles/:roleId/permissions`

Get permissions for a specific role.

**Auth**: Required  
**Permission**: `permission.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Role permissions fetched successfully",
  "data": [
    { "id": "...", "name": "employee.view" },
    { "id": "...", "name": "project.create" }
  ]
}
```

---

### `POST /roles/:roleId/permissions`

Replace all permissions for a role.

**Auth**: Required  
**Permission**: `permission.assign`

**Body**:
```json
{
  "permissionIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Restrictions**:
- Cannot modify your own role's permissions
- Can only assign permissions you yourself have

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Permissions assigned successfully",
  "data": { "roleId": "...", "permissionCount": 3 }
}
```

---

### `DELETE /roles/:roleId/permissions/:permissionId`

Remove a single permission from a role.

**Auth**: Required  
**Permission**: `permission.assign`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Permission removed successfully",
  "data": null
}
```

---

## Departments (`/departments`)

### `POST /departments`

Create a new department.

**Auth**: Required  
**Permission**: `department.create`

**Body**:
```json
{
  "name": "Engineering",
  "description": "Software engineering team"
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Department created successfully",
  "data": {
    "id": "...",
    "name": "Engineering",
    "description": "Software engineering team",
    "organizationId": "..."
  }
}
```

---

### `GET /departments`

Get all departments with employee counts.

**Auth**: Required  
**Permission**: `department.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Departments fetched successfully",
  "data": [
    { "id": "...", "name": "Engineering", "employeeCount": 10 },
    { "id": "...", "name": "Marketing", "employeeCount": 5 }
  ]
}
```

---

### `GET /departments/:id`

Get department by ID.

**Auth**: Required  
**Permission**: `department.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department fetched successfully",
  "data": {
    "id": "...",
    "name": "Engineering",
    "description": "Software engineering team",
    "employeeCount": 10
  }
}
```

---

### `PATCH /departments/:id`

Update department.

**Auth**: Required  
**Permission**: `department.update`

**Body**:
```json
{
  "name": "Software Engineering",
  "description": "Core engineering team"
}
```

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department updated successfully",
  "data": { "id": "...", "name": "Software Engineering" }
}
```

---

### `DELETE /departments/:id`

Soft delete a department.

**Auth**: Required  
**Permission**: `department.delete`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department deleted successfully",
  "data": null
}
```

---

### `GET /departments/:id/employees`

Get all employees in a department.

**Auth**: Required  
**Permission**: `department.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department employees fetched successfully",
  "data": [
    {
      "id": "...",
      "employeeCode": "EMP-001",
      "jobTitle": "Senior Engineer",
      "user": { "name": "John Doe", "email": "john@acme.com" }
    }
  ]
}
```

---

## Employees (`/employees`)

### `POST /employees`

Create a new employee (also creates a User account).

**Auth**: Required  
**Permission**: `employee.create`

**Body**:
```json
{
  "name": "Jane Smith",
  "email": "jane@acme.com",
  "roleId": "role-uuid",
  "departmentId": "dept-uuid",
  "jobTitle": "Frontend Developer",
  "salaryType": "MONTHLY",
  "salary": 5000,
  "joiningDate": "2026-01-15T00:00:00.000Z"
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Employee created successfully",
  "data": {
    "id": "...",
    "employeeCode": "EMP-002",
    "jobTitle": "Frontend Developer",
    "status": "ACTIVE",
    "user": { "name": "Jane Smith", "email": "jane@acme.com" },
    "department": { "name": "Engineering" }
  }
}
```

**Side Effects**: Sends welcome email with temporary password.

---

### `GET /employees`

Get all employees with pagination and filters.

**Auth**: Required  
**Permission**: `employee.view`

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `search` | string | — | Search by name/email |
| `departmentId` | string | — | Filter by department |
| `status` | string | — | Filter by status |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | `asc` or `desc` |

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employees fetched successfully",
  "data": [
    {
      "id": "...",
      "employeeCode": "EMP-001",
      "jobTitle": "Senior Engineer",
      "status": "ACTIVE",
      "user": { "name": "John Doe", "email": "john@acme.com" },
      "department": { "name": "Engineering" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

---

### `GET /employees/:id`

Get employee by ID.

**Auth**: Required  
**Permission**: `employee.view`

**Response** (200): Single employee object with user and department.

---

### `PATCH /employees/:id`

Update employee details.

**Auth**: Required  
**Permission**: `employee.update`

**Body**:
```json
{
  "departmentId": "new-dept-uuid",
  "jobTitle": "Lead Developer",
  "salary": 6000,
  "status": "ACTIVE"
}
```

**Restrictions**:
- Cannot set your own status to TERMINATED/SUSPENDED/INACTIVE
- Cannot change admin's status to any negative state

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee updated successfully",
  "data": { "id": "...", "jobTitle": "Lead Developer", "salary": 6000 }
}
```

---

### `DELETE /employees/:id`

Terminate an employee (soft delete).

**Auth**: Required  
**Permission**: `employee.delete`

**Restrictions**:
- Cannot terminate yourself
- Cannot terminate the admin

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee terminated successfully",
  "data": null
}
```

---

### `GET /employees/:id/stats`

Get employee statistics (tasks, submissions, hours).

**Auth**: Required  
**Permission**: `employee.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee stats fetched successfully",
  "data": {
    "totalTasks": 15,
    "completedTasks": 10,
    "totalSubmissions": 20,
    "approvedSubmissions": 18,
    "totalHoursWorked": 160
  }
}
```

---

### `POST /employees/:id/resend-credentials`

Resend welcome email with credentials.

**Auth**: Required  
**Permission**: `employee.create`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Credentials resent successfully",
  "data": null
}
```

---

## Projects (`/projects`)

### `POST /projects`

Create a new project.

**Auth**: Required  
**Permission**: `project.create`

**Body**:
```json
{
  "name": "Website Redesign",
  "description": "Complete redesign of company website",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-06-30T00:00:00.000Z",
  "budget": 50000
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Project created successfully",
  "data": {
    "id": "...",
    "name": "Website Redesign",
    "status": "PLANNED",
    "organizationId": "..."
  }
}
```

---

### `GET /projects`

Get all projects with pagination.

**Auth**: Required  
**Permission**: `project.view`

**Query Params**: `page`, `limit`, `search`, `status`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Projects fetched successfully",
  "data": [
    {
      "id": "...",
      "name": "Website Redesign",
      "status": "ACTIVE",
      "taskCount": 10,
      "startDate": "...",
      "endDate": "..."
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 12, "totalPages": 2 }
}
```

---

### `GET /projects/:id`

Get project by ID.

**Auth**: Required  
**Permission**: `project.view`

---

### `PATCH /projects/:id`

Update project.

**Auth**: Required  
**Permission**: `project.update`

**Body**:
```json
{
  "name": "Website Redesign v2",
  "status": "ACTIVE"
}
```

---

### `DELETE /projects/:id`

Soft delete a project.

**Auth**: Required  
**Permission**: `project.delete`

**Restrictions**: Cannot delete if project has active (non-deleted) tasks.

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Project deleted successfully",
  "data": null
}
```

---

### `GET /projects/:id/tasks`

Get all tasks for a project.

**Auth**: Required  
**Permission**: `project.view`, `task.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Project tasks fetched successfully",
  "data": [
    {
      "id": "...",
      "title": "Design homepage",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "employee": { "id": "...", "jobTitle": "Designer" }
    }
  ]
}
```

---

### `GET /projects/:id/stats`

Get project statistics.

**Auth**: Required  
**Permission**: `project.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Project stats fetched successfully",
  "data": {
    "totalTasks": 15,
    "completedTasks": 8,
    "totalSubmissions": 25,
    "approvedSubmissions": 20
  }
}
```

---

## Tasks (`/tasks`)

### `GET /tasks/my`

Get tasks assigned to the current employee.

**Auth**: Required  
**Permission**: `task.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "My tasks fetched successfully",
  "data": [
    {
      "id": "...",
      "title": "Design homepage",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "project": { "name": "Website Redesign" },
      "dueDate": "2026-02-01T00:00:00.000Z"
    }
  ]
}
```

---

### `POST /tasks`

Create a new task.

**Auth**: Required  
**Permission**: `task.create`

**Body**:
```json
{
  "projectId": "project-uuid",
  "employeeId": "employee-uuid",
  "title": "Design homepage mockup",
  "description": "Create wireframes and high-fidelity mockups",
  "estimatedHours": 20,
  "priority": "HIGH",
  "dueDate": "2026-02-01T00:00:00.000Z"
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Task created successfully",
  "data": {
    "id": "...",
    "title": "Design homepage mockup",
    "status": "TODO",
    "priority": "HIGH"
  }
}
```

---

### `GET /tasks`

Get all tasks with filters.

**Auth**: Required  
**Permission**: `task.view`

**Query Params**: `page`, `limit`, `search`, `status`, `priority`, `projectId`, `employeeId`

---

### `GET /tasks/:id`

Get task by ID with submissions.

**Auth**: Required  
**Permission**: `task.view`

---

### `PATCH /tasks/:id`

Update task details.

**Auth**: Required  
**Permission**: `task.update`

**Body**:
```json
{
  "title": "Design homepage mockup v2",
  "priority": "URGENT"
}
```

---

### `DELETE /tasks/:id`

Soft delete a task.

**Auth**: Required  
**Permission**: `task.delete`

**Restrictions**: Cannot delete if task has existing submissions.

---

### `POST /tasks/:id/assign`

Reassign a task to a different employee.

**Auth**: Required  
**Permission**: `task.assign`

**Body**:
```json
{
  "employeeId": "new-employee-uuid"
}
```

---

### `PATCH /tasks/:id/status`

Update task status.

**Auth**: Required  
**Permission**: `task.update`

**Body**:
```json
{
  "status": "IN_PROGRESS"
}
```

**Valid Statuses**: `TODO`, `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `REJECTED`, `COMPLETED`

---

### `GET /tasks/:id/submissions`

Get all submissions for a task.

**Auth**: Required  
**Permission**: `task.view`, `submission.view`

---

## Work Submissions (`/submissions`)

### `GET /submissions/my`

Get submissions by current employee.

**Auth**: Required  
**Permission**: `submission.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "My submissions fetched successfully",
  "data": [
    {
      "id": "...",
      "description": "Completed homepage design",
      "hoursWorked": 8,
      "workDate": "2026-01-15T00:00:00.000Z",
      "status": "PENDING",
      "task": { "title": "Design homepage" }
    }
  ]
}
```

---

### `POST /submissions`

Create a work submission.

**Auth**: Required  
**Permission**: `submission.create`

**Body**:
```json
{
  "taskId": "task-uuid",
  "description": "Completed the header section and hero banner design",
  "hoursWorked": 6,
  "workDate": "2026-01-15T00:00:00.000Z"
}
```

**Validation**: `description` min 10 chars, `hoursWorked` must be positive.

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Submission created successfully",
  "data": {
    "id": "...",
    "status": "PENDING",
    "hoursWorked": 6,
    "task": { "title": "Design homepage" }
  }
}
```

---

### `GET /submissions`

Get all submissions with filters.

**Auth**: Required  
**Permission**: `submission.view`

**Query Params**: `page`, `limit`, `status`, `taskId`, `employeeId`

---

### `GET /submissions/:id`

Get submission by ID.

**Auth**: Required  
**Permission**: `submission.view`

---

### `PATCH /submissions/:id`

Update a pending submission.

**Auth**: Required  
**Permission**: `submission.update`

**Body**:
```json
{
  "description": "Updated description with more details",
  "hoursWorked": 7
}
```

---

### `POST /submissions/:id/approve`

Approve a submission.

**Auth**: Required  
**Permission**: `submission.approve`

**Restrictions**: Cannot approve your own submission.

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Submission approved successfully",
  "data": {
    "id": "...",
    "status": "APPROVED",
    "reviewedAt": "2026-01-16T00:00:00.000Z"
  }
}
```

---

### `POST /submissions/:id/reject`

Reject a submission with reason.

**Auth**: Required  
**Permission**: `submission.reject`

**Body**:
```json
{
  "reason": "Insufficient detail in description. Please resubmit with more information."
}
```

**Validation**: `reason` min 10, max 500 chars.

---

## Payroll (`/payroll`)

### `GET /payroll/my`

Get payrolls for current employee.

**Auth**: Required  
**Permission**: `payroll.view_own`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "My payrolls fetched successfully",
  "data": [
    {
      "id": "...",
      "periodStart": "2026-01-01T00:00:00.000Z",
      "periodEnd": "2026-01-31T00:00:00.000Z",
      "grossAmount": 5000,
      "deductions": 500,
      "netAmount": 4500,
      "status": "APPROVED"
    }
  ]
}
```

---

### `POST /payroll/generate`

Generate payroll for an employee.

**Auth**: Required  
**Permission**: `payroll.generate`

**Body**:
```json
{
  "employeeId": "employee-uuid",
  "periodStart": "2026-01-01T00:00:00.000Z",
  "periodEnd": "2026-01-31T00:00:00.000Z",
  "deductions": 500
}
```

**Restrictions**: Cannot generate payroll for yourself.

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payroll generated successfully",
  "data": {
    "id": "...",
    "grossAmount": 5000,
    "deductions": 500,
    "netAmount": 4500,
    "status": "GENERATED"
  }
}
```

---

### `GET /payroll`

Get all payrolls with filters.

**Auth**: Required  
**Permission**: `payroll.view`

**Query Params**: `page`, `limit`, `status`, `employeeId`

---

### `GET /payroll/:id`

Get payroll by ID.

**Auth**: Required  
**Permission**: `payroll.view`

**Restrictions**: Users with `payroll.view_own` can only view their own payroll.

---

### `POST /payroll/:id/approve`

Approve a payroll.

**Auth**: Required  
**Permission**: `payroll.approve`

**Restrictions**: Cannot approve your own payroll.

---

### `POST /payroll/:id/reject`

Reject a payroll.

**Auth**: Required  
**Permission**: `payroll.reject`

---

## Payments (`/payments`)

### `POST /payments/webhook`

Stripe webhook handler (no auth).

**Content-Type**: `application/json` (raw body)

**Stripe Events Handled**:
- `checkout.session.completed` → marks payment COMPLETED, payroll PAID
- `checkout.session.async_payment_failed` → marks payment FAILED
- `payment_intent.payment_failed` → marks payment FAILED

**Idempotency**: Skips if payment already in terminal state.

---

### `GET /payments/my`

Get payments for current employee.

**Auth**: Required  
**Permission**: `payment.view_own`

---

### `POST /payments`

Create a Stripe checkout session for a payroll.

**Auth**: Required  
**Permission**: `payment.create`

**Body**:
```json
{
  "payrollId": "payroll-uuid",
  "currency": "usd"
}
```

**Response** (201):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payment session created successfully",
  "data": {
    "id": "...",
    "sessionId": "cs_test_...",
    "sessionUrl": "https://checkout.stripe.com/..."
  }
}
```

---

### `GET /payments`

Get all payments with filters.

**Auth**: Required  
**Permission**: `payment.view`

**Query Params**: `page`, `limit`, `status`, `employeeId`

---

### `GET /payments/:id`

Get payment by ID.

**Auth**: Required  
**Permission**: `payment.view`

---

## Audit Logs (`/audit-logs`)

### `GET /audit-logs`

Get all audit logs with pagination.

**Auth**: Required  
**Permission**: `audit.view`

**Query Params**: `page`, `limit`, `entity`, `action`, `userId`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Audit logs fetched successfully",
  "data": [
    {
      "id": "...",
      "action": "CREATE_EMPLOYEE",
      "entity": "Employee",
      "entityId": "...",
      "user": { "name": "John Admin", "email": "admin@acme.com" },
      "metadata": { "name": "Jane Smith" },
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 }
}
```

---

### `GET /audit-logs/:id`

Get audit log by ID.

**Auth**: Required  
**Permission**: `audit.view`

---

## Analytics (`/analytics`)

### `GET /analytics/dashboard`

Get dashboard overview.

**Auth**: Required  
**Permission**: `analytics.view`

**Response** (200):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard analytics fetched successfully",
  "data": {
    "totalEmployees": 25,
    "activeProjects": 8,
    "pendingSubmissions": 12,
    "totalPayroll": 125000
  }
}
```

---

### `GET /analytics/employees`

Get employee analytics.

**Auth**: Required  
**Permission**: `analytics.view`

---

### `GET /analytics/projects`

Get project analytics.

**Auth**: Required  
**Permission**: `analytics.view`

---

### `GET /analytics/payroll`

Get payroll analytics.

**Auth**: Required  
**Permission**: `analytics.view`

---

### `GET /analytics/payments`

Get payment analytics.

**Auth**: Required  
**Permission**: `analytics.view`

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errorDetails": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Pagination

All list endpoints support pagination via query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |

**Response Meta**:
```json
{
  "page": 1,
  "limit": 10,
  "total": 50,
  "totalPages": 5
}
```
