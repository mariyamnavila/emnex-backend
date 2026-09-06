<div align="center">

# 📡 Complete API Integration Reference

### *RESTful Endpoints, Request Schemas, & Response Payloads*

[![Base URL](https://img.shields.io/badge/Base_URL-https%3A%2F%2Femnex--api.vercel.app%2Fapi%2Fv1-blue?style=for-the-badge&logo=vercel&logoColor=white)](https://emnex-api.vercel.app)
[![Format](https://img.shields.io/badge/Content--Type-application%2Fjson-green?style=for-the-badge)](#-global-headers--authentication)
[![Endpoints](https://img.shields.io/badge/Total_Endpoints-78-orange?style=for-the-badge)](#-endpoint-index)

</div>

---

## 📌 Global Headers & Authentication

| Header | Value | Description |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Required for all POST / PATCH requests |
| `Authorization` | `Bearer <accessToken>` | JWT authentication token |
| `Cookie` | `accessToken=...; refreshToken=...` | Alternative cookie-based auth |

---

## 🗺️ Endpoint Index

| Module | Base Path | Endpoints Count | Key Actions |
| :--- | :--- | :---: | :--- |
| [🔑 Auth](#1-auth-module) | `/auth` | 7 | Register, Login, Refresh, Password Change, Google OAuth |
| [🏢 Organization](#2-organization-module) | `/organizations` | 4 | Get Org Profile, Stats, Update Org |
| [🛡️ Roles & Permissions](#3-roles--permissions-module) | `/roles` | 9 | Create Role, List Roles, Assign / Remove Permissions |
| [🏛️ Departments](#4-departments-module) | `/departments` | 6 | Department CRUD & Member Listing |
| [👥 Employees](#5-employees-module) | `/employees` | 7 | Employee CRUD, Search, Filter, Resend Credentials |
| [📁 Projects](#6-projects-module) | `/projects` | 7 | Project CRUD, Tasks List, Budget Stats |
| [📋 Tasks](#7-tasks-module) | `/tasks` | 9 | Task Assignment, Status Updates, Submissions |
| [📤 Submissions](#8-submissions-module) | `/submissions` | 7 | Log Work Hours, Review, Approve / Reject |
| [💵 Payroll](#9-payroll-module) | `/payroll` | 7 | Auto-Calculate Payroll, Approvals, Summaries |
| [💳 Payments](#10-payments-module) | `/payments` | 6 | Stripe Checkout Sessions & Webhooks |
| [📊 Analytics](#11-analytics-module) | `/analytics` | 5 | Dashboard Metrics for Admin, HR, Finance & Employee |
| [📜 Audit Logs](#12-audit-logs-module) | `/audit-logs` | 2 | Activity Tracking & Filtering |
| [⚙️ System](#13-system-module) | `/` | 1 | Health Check Endpoint |

---

## 1. 🔑 Auth Module (`/auth`)

### `POST /auth/register`
*Register a new Organization along with the Primary Admin User.*

- **Auth**: None
- **Body**:
```json
{
  "organizationName": "Acme Software Inc",
  "organizationSlug": "acme-software",
  "name": "John Admin",
  "email": "admin@acme.com",
  "password": "SecurePassword123!"
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Organization registered successfully",
  "data": {
    "organization": {
      "id": "c1f7289b-7345-42df-a316-5278065d648b",
      "name": "Acme Software Inc",
      "slug": "acme-software"
    },
    "user": {
      "id": "u9b2189a-1122-3344-5566-778899aabbcc",
      "name": "John Admin",
      "email": "admin@acme.com",
      "role": "ADMIN"
    },
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

---

### `POST /auth/login`
*Authenticate existing user using email & password.*

- **Auth**: None
- **Body**:
```json
{
  "email": "admin@acme.com",
  "password": "SecurePassword123!"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": {
      "id": "u9b2189a-1122-3344-5566-778899aabbcc",
      "name": "John Admin",
      "email": "admin@acme.com",
      "role": "ADMIN",
      "organizationId": "c1f7289b-7345-42df-a316-5278065d648b"
    }
  }
}
```

---

### `GET /auth/me`
*Get profile details of the authenticated user.*

- **Auth**: `Bearer {{accessToken}}`
- **Response** (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile fetched successfully",
  "data": {
    "id": "u9b2189a-1122-3344-5566-778899aabbcc",
    "name": "John Admin",
    "email": "admin@acme.com",
    "role": "ADMIN",
    "organization": {
      "id": "c1f7289b-7345-42df-a316-5278065d648b",
      "name": "Acme Software Inc"
    }
  }
}
```

---

## 2. 👥 Employees Module (`/employees`)

### `POST /employees`
*Create a new Employee profile and associated User account.*

- **Auth**: `Bearer {{accessToken}}` (`employee.create` permission)
- **Body**:
```json
{
  "name": "Sarah Jenkins",
  "email": "sarah@acme.com",
  "roleId": "r3e45678-e89b-12d3-a456-426614174000",
  "departmentId": "d1e23456-e89b-12d3-a456-426614174000",
  "jobTitle": "Senior Frontend Engineer",
  "salaryType": "MONTHLY",
  "salary": 6500,
  "joiningDate": "2026-03-01T00:00:00.000Z"
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Employee created successfully",
  "data": {
    "id": "emp-9988-7766-5544",
    "employeeCode": "EMP-003",
    "jobTitle": "Senior Frontend Engineer",
    "status": "ACTIVE",
    "user": {
      "name": "Sarah Jenkins",
      "email": "sarah@acme.com"
    }
  }
}
```

---

## 3. 💵 Payroll Module (`/payroll`)

### `POST /payroll/generate`
*Auto-calculate employee gross and net compensation from approved work hours.*

- **Auth**: `Bearer {{accessToken}}` (`payroll.generate` permission)
- **Body**:
```json
{
  "employeeId": "emp-9988-7766-5544",
  "periodStart": "2026-03-01T00:00:00.000Z",
  "periodEnd": "2026-03-31T23:59:59.999Z",
  "deductions": 150.00
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payroll generated successfully",
  "data": {
    "id": "pay-1234-5678-9012",
    "employeeId": "emp-9988-7766-5544",
    "periodStart": "2026-03-01T00:00:00.000Z",
    "periodEnd": "2026-03-31T23:59:59.999Z",
    "grossAmount": 6500.00,
    "deductions": 150.00,
    "netAmount": 6350.00,
    "status": "DRAFT"
  }
}
```

---

## 4. 💳 Payment Module (`/payments`)

### `POST /payments`
*Create Stripe Checkout Session for approved payroll settlement.*

- **Auth**: `Bearer {{accessToken}}` (`payment.create` permission)
- **Body**:
```json
{
  "payrollId": "pay-1234-5678-9012",
  "currency": "usd"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stripe checkout session created successfully",
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4...",
    "payment": {
      "id": "pmt-9988-7766-5544",
      "payrollId": "pay-1234-5678-9012",
      "amount": 6350.00,
      "currency": "usd",
      "status": "PROCESSING"
    }
  }
}
```

---

[⬅️ Return to README.md](./README.md)
