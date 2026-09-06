<div align="center">

# ⚡ EmNex Backend

### *Enterprise Multi-Tenant Workforce, Project & Payroll Platform*

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Stripe](https://img.shields.io/badge/Stripe-API-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)
[![Deployment](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://emnex-api.vercel.app)

**Base URL**: `https://emnex-api.vercel.app/api/v1`

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Documentation Hub](#-documentation-hub)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup](#database-setup)
  - [Running the Server](#running-the-server)
- [Authentication & Security](#-authentication--security)
- [Roles & Permissions (RBAC)](#-roles--permissions-rbac)
- [Edge Case Protections](#-edge-case-protections)
- [Integrations](#-integrations)
- [NPM Command Reference](#-npm-command-reference)

---

## 🚀 Overview

**EmNex** is a robust, multi-tenant SaaS backend API engineered for modern enterprises. It provides end-to-end management for employee lifecycles, department hierarchies, projects, tasks, work hour submissions, automated payroll calculation, and Stripe checkout payments.

Each organization operates in complete **tenant-level data isolation**, backed by a fine-grained **Role-Based Access Control (RBAC)** matrix featuring **42 system permissions**.

> [!IMPORTANT]
> **Production API Base Endpoint**: `https://emnex-api.vercel.app/api/v1`  
> All requests must include standard `Content-Type: application/json` headers. Authenticated endpoints require an `Authorization: Bearer <accessToken>` header or HTTP-only auth cookies.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[📱 Client App / Postman] -->|HTTPS Requests| Express[🚀 Express 5 API Server]
    
    subgraph Middleware Pipeline
        Express --> Helmet[🛡️ Helmet Security Headers]
        Helmet --> RateLimit[⏱️ Rate Limiting]
        RateLimit --> Cors[🌐 CORS Protection]
        Cors --> AuthCheck[🔑 JWT Auth & Status Check]
        AuthCheck --> PermCheck[🔐 RBAC Permission Verification]
        PermCheck --> ZodVal[📋 Zod Input Validation]
    end
    
    ZodVal --> Controller[🎮 Controller Layer]
    Controller --> Service[💼 Service Layer]
    
    subgraph Data & Integrations
        Service --> Prisma[(🐘 PostgreSQL / Prisma 7)]
        Service --> Stripe[💳 Stripe Payments API]
        Service --> Cloudinary[🖼️ Cloudinary Avatar Storage]
        Service --> Nodemailer[📧 Nodemailer SMTP Emails]
    end
    
    Service --> Audit[📜 Fire-and-Forget Audit Logger]
    Audit --> Prisma
```

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🏢 Multi-Tenant Isolation** | Data automatically scoped by `organizationId` across all entities. |
| **🔐 Granular RBAC (42 Perms)** | 4 pre-configured system roles (`ADMIN`, `HR_MANAGER`, `FINANCE_MANAGER`, `EMPLOYEE`) + custom role support. |
| **🔑 Dual Authentication** | JWT Access (24h) + Refresh Token (7d) in HTTP-only cookies + Google OAuth 2.0 integration. |
| **👥 Employee Lifecycle** | Hire → Assign Role & Department → Suspend/Inactivate → Terminate with strict admin locks. |
| **📋 Projects & Tasks** | Multi-status project management, task assignment, priority tagging, and due-date tracking. |
| **📤 Work Submission Loop** | Employee hour logging → Manager review → Approve / Reject with mandatory feedback. |
| **💵 Automated Payroll** | Auto-calculated gross/net pay from approved work submission hours and hourly/monthly rates. |
| **💳 Stripe Payments** | One-click Stripe Checkout Session generation + webhook listener for status sync (`PAID`). |
| **📊 Real-time Analytics** | Role-tailored dashboard metrics for Admins, HR Managers, Finance Managers, and Employees. |
| **📜 Comprehensive Audit Logs** | 27 audit actions recorded with user context, entity IDs, metadata, and IP address. |
| **🛡️ Edge Protection** | Safeguards against self-approval, self-termination, admin locking, and permission escalation. |

---

## 🛠️ Tech Stack

```ascii
 ┌───────────────────┬─────────────────────────────────────────────────────────────┐
 │ Technology        │ Component / Functionality                                   │
 ├───────────────────┼─────────────────────────────────────────────────────────────┤
 │ Runtime & Server  │ Node.js 18+ • Express 5.x • TypeScript 5.x                   │
 │ Database & ORM    │ PostgreSQL 16 • Prisma 7 ORM (@prisma/adapter-pg)          │
 │ Authentication    │ JWT (JsonWebToken) • Bcrypt Password Hashing • Google OAuth │
 │ Validation & Lint │ Zod Schema Validation • Biome Code Formatter & Linter        │
 │ Payment Gateway   │ Stripe Checkout API • Stripe Webhook Signature Verification │
 │ File Storage      │ Cloudinary API • Multer Multipart Middleware                │
 │ Email Service     │ Nodemailer • EJS HTML Email Templates                       │
 └───────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation Hub

Explore detailed documentation modules:

| Document | Link | Description |
| :--- | :--- | :--- |
| **Architecture Guide** | [ARCHITECTURE.md](./ARCHITECTURE.md) | Deep dive into codebase structure, 5-file module pattern, error handling & middleware. |
| **Database Schema** | [DATABASE.md](./DATABASE.md) | ERD diagrams, model definitions, enums, soft-delete strategies, and indexes. |
| **API Reference** | [API_INTEGRATION.md](./API_INTEGRATION.md) | Endpoint specifications, payloads, responses, and query parameters. |
| **System Workflows** | [WORKFLOW.md](./WORKFLOW.md) | State machine diagrams, data pipelines, payroll math, and webhook handling. |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed locally:
- **Node.js**: `v18.0.0` or higher
- **PostgreSQL**: `v14.0` or higher (or cloud provider like Neon / Supabase)
- **Stripe Account**: For testing payment checkout sessions
- **Cloudinary Account**: For avatar uploads

---

### Installation

```bash
# Clone the repository
git clone https://github.com/mariyamnavila/emnex-backend.git

# Navigate to project directory
cd EmNex-Backend

# Install dependencies
npm install
```

---

### Environment Configuration

Create a `.env` file in the root directory and configure the variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
APP_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/emnex_db?schema=public"

# Authentication Secrets
JWT_ACCESS_SECRET="your-super-secret-access-token-key-min-32-chars"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key-min-32-chars"
JWT_ACCESS_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS=12

# Third-Party Integrations
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
STRIPE_SECRET_KEY="sk_test_51..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Cloudinary Setup
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Nodemailer Email Credentials
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-gmail-app-password"
```

---

### Database Setup

```bash
# Generate Prisma Client & Push Schema to Database
npx prisma db push

# Run Database Migrations (Alternative)
npx prisma migrate dev --name init

# Seed System Roles & Permissions (Automated on server start)
npm run dev
```

---

### Running the Server

```bash
# Development Mode (Hot Reload with tsx)
npm run dev

# Production Build
npm run build

# Start Production Server
npm start

# Stripe Webhook Listener (Local Testing)
npm run stripe:webhook
```

The API will be live at `http://localhost:5000/api/v1`

---

## 🔐 Authentication & Security

> [!NOTE]
> EmNex implements multi-layered security protections out of the box.

```
Client Request ──► Rate Limiter ──► Helmet Headers ──► CORS Check ──► JWT Verification ──► RBAC Check ──► Controller
```

- **HTTP-Only Cookies**: Access tokens (`24h`) and Refresh tokens (`7d`) stored securely.
- **Token Invalidation**: Password updates increment `tokenVersion`, invalidating active refresh tokens globally.
- **Rate Limiting**: 
  - Global API: `100 requests / 15 mins` per IP
  - Auth Routes (`/auth/*`): `20 requests / 15 mins` per IP
- **Input Sanitization**: Strict Zod schemas sanitize and validate every single incoming payload field.

---

## 🛡️ Roles & Permissions (RBAC)

### Pre-Configured System Roles

| System Role | Primary Scope | Perms Count | Key Capabilities |
| :--- | :--- | :---: | :--- |
| 👑 **ADMIN** | System Administrator | `42` / `42` | Full organization management, role creation, system config. |
| 👥 **HR_MANAGER** | Workforce & Operations | `21` / `42` | Employee hiring, department setup, work review, project creation. |
| 💰 **FINANCE_MANAGER** | Financial Operations | `14` / `42` | Payroll generation, approval, Stripe payment execution, financials. |
| 👤 **EMPLOYEE** | Individual Contributor | `5` / `42` | Task completion, work hour submission, own payroll/payment viewing. |

---

## ⚡ Edge Case Protections

> [!WARNING]
> Built-in safeguards protect business integrity and prevent administrative lockouts.

- 🔒 **Admin Lock**: Nobody can set the primary Admin account to `TERMINATED`, `SUSPENDED`, or `INACTIVE`.
- 🚫 **Self-Action Block**: Users cannot terminate/suspend themselves or approve their own submissions/payrolls.
- 🛑 **Permission Escalation Prevention**: Users can only assign permissions that they currently possess.
- 🛡️ **Orphan Guards**: Tasks with existing submissions or Projects with active tasks cannot be deleted.
- 🔄 **Webhook Idempotency**: Stripe Webhook events check existing transaction state to prevent duplicate payroll payouts.

---

## 🔌 Integrations

```ascii
    [ Stripe ]         ──► Processing Card Checkout & Webhook Sync
    [ Cloudinary ]     ──► Resizing & Storing Avatar Uploads
    [ Google OAuth ]   ──► One-Tap Social Authentication
    [ Nodemailer ]     ──► Generating HTML Welcome Emails with Credentials
```

---

## 📜 NPM Command Reference

```bash
# Development & Build
npm run dev           # Start development server with hot-reload
npm run build         # Compile TypeScript code to dist/
npm start             # Launch compiled production bundle

# Code Quality & Formatting
npm run format:check  # Check formatting with Biome
npm run format:fix    # Fix auto-formattable style issues
npm run lint:check    # Lint codebase for errors
npm run lint:fix      # Auto-fix lint errors

# Utilities
npm run stripe:webhook # Listen & forward Stripe events locally
```

---

<div align="center">

Made with ❤️ by Bibi Mariyam  
*EmNex Platform © 2026. All Rights Reserved.*

</div>
