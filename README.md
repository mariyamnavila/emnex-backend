# EmNex Backend

Workforce, Project & Payroll Management Platform API

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the Server](#running-the-server)
- [Project Structure](#project-structure) → [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Database Schema](#database-schema) → [DATABASE.md](./DATABASE.md)
- [API Reference](#api-reference) → [API_INTEGRATION.md](./API_INTEGRATION.md)
- [Authentication & Authorization](#authentication--authorization)
- [Roles & Permissions](#roles--permissions)
- [Soft Delete Strategy](#soft-delete-strategy)
- [Edge Case Protections](#edge-case-protections)
- [Services Integration](#services-integration)
- [Scripts](#scripts)

---

## Overview

EmNex is a multi-tenant SaaS backend for managing employees, projects, tasks, work submissions, payroll, and payments. Each organization gets its own isolated data space with role-based access control.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 7 (with `@prisma/adapter-pg`) |
| Authentication | JWT (Access + Refresh tokens) |
| Validation | Zod |
| Payment | Stripe |
| File Upload | Cloudinary + Multer |
| Email | Nodemailer + EJS templates |
| Security | Helmet, Rate Limiting, CORS |
| Linting | Biome |

## Features

- Multi-tenant organization isolation
- JWT authentication with access/refresh tokens
- Role-based access control (RBAC) with 42 granular permissions
- Google OAuth login
- Employee lifecycle management (hire → suspend → terminate)
- Project & task management with assignment tracking
- Work submission workflow (submit → approve/reject)
- Automated payroll generation from approved submissions
- Stripe payment integration with webhook handling
- Comprehensive audit logging
- Analytics dashboard endpoints
- File upload (avatars) via Cloudinary
- Email notifications (employee welcome emails)
- Soft delete for data retention
- Rate limiting (100 req/15min global, 20 req/15min auth)
- Input validation on all endpoints
- Global error handling with Prisma error mapping

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account (for payments)
- Cloudinary account (for file uploads)
- Google Cloud Console project (for OAuth)
- SMTP email account (for notifications)

### Installation

```bash
git clone <repository-url>
cd EmNex-Backend
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?pgbouncer=true&connection_limit=5

# Frontend
FRONTEND_URL=http://localhost:3000

# JWT
JWT_ACCESS_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Bcrypt
BCRYPT_SALT_ROUNDS=12

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App
APP_URL=http://localhost:5000

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# SMTP (Gmail)
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Database Setup

```bash
# Run migrations
npx prisma migrate dev

# Seed system roles and permissions (runs automatically on server start)
npx tsx src/server.ts
```

### Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Stripe webhook forwarding (separate terminal)
npm run stripe:webhook
```

Server runs at `http://localhost:5000`

---

## Authentication & Authorization

### Authentication Flow

1. **Register**: Creates organization + admin user → returns JWT tokens
2. **Login**: Validates credentials → returns JWT tokens
3. **Google Login**: Validates Google ID token → returns JWT tokens
4. **Refresh Token**: Exchange refresh token for new access token
5. **Logout**: Clears cookies

### Token Storage

Tokens are stored as HTTP-only cookies:
- `accessToken` — 24 hour expiry
- `refreshToken` — 7 day expiry

Also returned in response body for non-cookie clients (Bearer token).

### Authorization Flow

1. `auth()` middleware verifies JWT and loads user + role + permissions from DB
2. `checkPermission(...permissions)` middleware checks if user has required permissions
3. Both must pass before reaching the controller

### Password Requirements

- Minimum 8 characters
- At least 1 lowercase letter
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character

---

## Roles & Permissions

### System Roles (Seeded)

| Role | Description | Permissions |
|------|-------------|-------------|
| ADMIN | Full organization management | All 42 permissions |
| HR_MANAGER | Workforce management | organization.view, employee.*, department.*, project.view, task.view, submission.*, analytics.view |
| FINANCE_MANAGER | Financial operations | organization.view, employee.view, payroll.*, payment.*, analytics.view |
| EMPLOYEE | Basic employee access | task.view, submission.view, submission.create, payroll.view_own, permission.view |

### All 42 Permissions

| Category | Permissions |
|----------|------------|
| Organization | `organization.view`, `organization.update` |
| Employee | `employee.view`, `employee.create`, `employee.update`, `employee.delete` |
| Department | `department.view`, `department.create`, `department.update`, `department.delete` |
| Project | `project.view`, `project.create`, `project.update`, `project.delete` |
| Task | `task.view`, `task.create`, `task.update`, `task.delete`, `task.assign` |
| Submission | `submission.view`, `submission.create`, `submission.update`, `submission.approve`, `submission.reject` |
| Payroll | `payroll.view`, `payroll.view_own`, `payroll.generate`, `payroll.approve`, `payroll.reject` |
| Payment | `payment.view`, `payment.view_own`, `payment.create`, `payment.refund` |
| Role | `role.view`, `role.create`, `role.update`, `role.delete` |
| Permission | `permission.view`, `permission.assign` |
| Audit | `audit.view` |
| Analytics | `analytics.view` |

---

## Soft Delete Strategy

The following models use soft delete (via `deletedAt` field):

| Model | Impact |
|-------|--------|
| Role | Deleted roles are excluded from queries |
| Department | Deleted departments are excluded from queries |
| Project | Deleted projects excluded; deletion blocked if active tasks exist |
| Task | Deleted tasks excluded; deletion blocked if submissions exist |

Models WITHOUT soft delete (hard delete not used — records are permanent):
- WorkSubmission
- Payroll
- Payment
- AuditLog

---

## Edge Case Protections

| Protection | Description |
|-----------|-------------|
| Admin status lock | Nobody can set admin to TERMINATED/SUSPENDED/INACTIVE |
| Admin termination lock | Nobody can terminate the admin account |
| Self-action prevention | Users cannot terminate/suspend their own account |
| Self-approval prevention | Employees cannot approve their own submissions/payrolls |
| Self-generation prevention | Employees cannot generate their own payroll |
| Permission scoping | Users can only assign permissions they themselves have |
| Own role protection | Users cannot modify their own role's permissions |
| Role rename guard | Roles assigned to users cannot be renamed |
| Submission orphan guard | Tasks with submissions cannot be deleted |
| Active task guard | Projects with active tasks cannot be deleted |
| Password change token invalidation | `tokenVersion` incremented on password change |
| Terminated employee block | Terminated employees cannot authenticate |
| Admin data isolation | Admin-only endpoints check role name |
| Webhook idempotency | Stripe webhook events are idempotent |
| View_own isolation | Employees with `view_own` can only see their own payroll/payments |

---

## Services Integration

| Service | Purpose | Config Required |
|---------|---------|-----------------|
| **Stripe** | Payment processing via Checkout Sessions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Cloudinary** | Avatar/image upload and hosting | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Google OAuth** | Social login | `GOOGLE_CLIENT_ID` |
| **Nodemailer** | Email notifications (welcome emails) | `SMTP_USER`, `SMTP_PASSWORD` |
| **Neon/PostgreSQL** | Database | `DATABASE_URL` |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run stripe:webhook` | Forward Stripe webhooks to localhost |
| `npm run format:check` | Check code formatting |
| `npm run format:fix` | Fix code formatting |
| `npm run lint:check` | Check linting |
| `npm run lint:fix` | Fix linting issues |

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Project structure, middleware, utilities, and design patterns
- [DATABASE.md](./DATABASE.md) — Complete database schema with all models, relations, and indexes
- [API_INTEGRATION.md](./API_INTEGRATION.md) — All 52 API endpoints with request/response examples
- [WORKFLOW.md](./workflow.md) — System flows, data pipelines, and module connections
