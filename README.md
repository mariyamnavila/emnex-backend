<div align="center">

# EmNex — Backend API

**Multi-tenant workforce, project and payroll platform.**
Employees log hours on tasks, managers review them, finance turns approved hours into payroll and pays it through Stripe.

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?logo=stripe&logoColor=white)](https://stripe.com)

**Live API:** `https://emnex-api.vercel.app/api/v1` &nbsp;·&nbsp; **Live app:** [emnex-frontend.vercel.app](https://emnex-frontend.vercel.app) &nbsp;·&nbsp; **Frontend repo:** [emnex-frontend](https://github.com/mariyamnavila/emnex-frontend)

</div>

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Roles and permissions](#roles-and-permissions)
- [Business rules at a glance](#business-rules-at-a-glance)
- [Security](#security)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Further documentation](#further-documentation)
- [Known limitations](#known-limitations)

---

## What it does

| Area | Summary |
| :--- | :--- |
| **Organizations** | Every company is an isolated tenant. All data is scoped by `organizationId`. Registering creates the organization, its four built-in roles and the first admin. |
| **People** | Departments and employees (monthly salary or hourly rate). New employees get a temporary password by email and must change it on first login. |
| **Roles** | 44 permissions, 4 built-in roles per organization, unlimited custom roles. Built-in roles can be reset to their defaults. |
| **Projects and tasks** | Projects contain tasks assigned to one employee. Tasks move through a fixed status flow (to do → in progress → submitted → approved → completed). |
| **Work hours** | Employees log hours against their own tasks; reviewers approve or reject them with a note. |
| **Payroll** | Gross pay is calculated from monthly salary or approved hours × rate, plus an optional extra amount, minus deductions. |
| **Payments** | Approved payroll is paid through Stripe Checkout. A signed webhook (or a verify call from the success page) marks it paid. |
| **Insight** | Dashboard analytics and a full audit log of 34 kinds of actions. |

---

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Runtime | Node.js 22, Express 5, TypeScript |
| Database | PostgreSQL, Prisma 7 (`@prisma/adapter-pg`, multi-file schema) |
| Validation | Zod 4 |
| Auth | JWT access + refresh tokens (httpOnly cookies), bcrypt, Google sign-in (`google-auth-library`) |
| Payments | Stripe Checkout + webhooks |
| Files and email | Cloudinary + Multer (avatars), Nodemailer + EJS (welcome email) |
| Security | Helmet, CORS (credentials), `express-rate-limit` |
| Tooling | `tsx` (dev), `tsup` (build), Biome (lint/format) |

---

## Getting started

### Prerequisites

- Node.js 22+
- A PostgreSQL database (local, Neon, Supabase…)
- Stripe test keys (and the [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhooks)
- Optional: Cloudinary (avatars), a Gmail app password (welcome emails), a Google OAuth client ID

### 1. Install

```bash
git clone https://github.com/mariyamnavila/emnex-backend.git
cd emnex-backend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill it in.

| Variable | Required | Notes |
| :--- | :---: | :--- |
| `NODE_ENV` | ✓ | `development` or `production` (production sets `Secure` cookies) |
| `PORT` | ✓ | e.g. `5000` |
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `FRONTEND_URL` | ✓ | Allowed CORS origin, e.g. `http://localhost:3000` |
| `APP_URL` | ✓ | **The frontend URL.** Stripe sends payers back to `${APP_URL}/payment/success` and `/payment/cancel` |
| `BCRYPT_SALT_ROUNDS` | ✓ | e.g. `10` |
| `JWT_ACCESS_SECRET` | ✓ | **Must match the frontend's `JWT_ACCESS_SECRET`** — the frontend verifies the same token |
| `JWT_REFRESH_SECRET` | ✓ | Different from the access secret |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | ✓ | e.g. `1d` / `7d` |
| `STRIPE_SECRET_KEY` | ✓ | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | ✓ | `whsec_…` (printed by `npm run stripe:webhook` locally) |
| `GOOGLE_CLIENT_ID` | – | Enables Google sign-in |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | – | Enables avatar upload |
| `SMTP_USER` / `SMTP_PASSWORD` | – | Gmail address + app password for welcome emails |

> [!NOTE]
> Creating an employee also returns their temporary password in the API response, so onboarding still works when SMTP isn't configured (the email just isn't sent).

### 3. Set up the database

The Prisma config file is named `prisma7.config.ts`, so pass it explicitly:

```bash
npx prisma migrate deploy --config prisma7.config.ts   # apply migrations
npx prisma generate      --config prisma7.config.ts    # generate the client into src/generated
```

### 4. Run

```bash
npm run dev            # http://localhost:5000/api/v1
```

On every start the server **seeds the permission catalog and the four global role templates** (idempotent — it only adds what is missing).

### 5. Load demo data (optional)

Start the server once first (step 4), then:

```bash
npm run seed:demo                        # "EmNex Demo" org + the 4 demo accounts
npx tsx src/scripts/seed-demo-data.ts    # adds employees, projects, tasks, hours, payroll, payments
```

`seed:demo` does nothing if the demo org exists; `npm run seed:demo:force` wipes and recreates it. `seed-demo-data.ts` is also safe to re-run.

### 6. Stripe webhooks locally

```bash
npm run stripe:webhook   # forwards events to localhost:5000/api/v1/payments/webhook
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. Test card: `4242 4242 4242 4242`, any future date, any CVC.

---

## Demo accounts

Created by `npm run seed:demo` in the **EmNex Demo** organization:

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@emnex.com` | `EmnexAdmin123!` |
| HR Manager | `manager@emnex.com` | `EmnexManager123!` |
| Finance Manager | `finance@emnex.com` | `EmnexFinance123!` |
| Employee | `employee@emnex.com` | `EmnexEmployee123!` |

Extra employees from `seed-demo-data.ts` (e.g. `alex.chen@emnex.demo`) use `Demo1234!`.

---

## Roles and permissions

Permissions follow a `resource.action` pattern. Where both exist, **`_own` means "only my own records" and the plain permission means "everyone's"** — e.g. `task.view_own` vs `task.view`. Routes check permissions, never role names, so a custom role gets exactly the access its permissions describe. (One exception: the *content* of `GET /analytics/dashboard` is chosen by built-in role name — see [Known limitations](#known-limitations).)

| Built-in role | Permissions | Can do |
| :--- | :---: | :--- |
| **ADMIN** | 44 / 44 | Everything, including roles, audit log and organization settings |
| **HR_MANAGER** | 20 | Employees, departments, view projects/tasks, review work hours, analytics |
| **FINANCE_MANAGER** | 17 | Generate / approve / reject payroll, pay through Stripe, analytics |
| **EMPLOYEE** | 7 | Self-service only: own tasks, own work hours, own payroll and payments |

HR, Finance and Employee all share the same 7 **self-service** permissions (`task.view_own`, `task.update_own`, `submission.view_own`, `submission.create`, `submission.update`, `payroll.view_own`, `payment.view_own`), so managers can also work tasks and see their own pay.

Each organization gets its **own copy** of the built-in roles, so editing them in one organization never affects another. The full permission list is in [ARCHITECTURE.md](./ARCHITECTURE.md#permission-catalog).

---

## Business rules at a glance

- **Nobody acts on their own work** — you can't approve or reject your own hours; approve, reject or complete your own task; generate, approve or pay your own payroll; change your own role; suspend or terminate yourself; or edit your own role's permissions.
- **No privilege escalation** — you can only grant permissions (or assign a role) that you already hold.
- **Admins are protected** — a user with the ADMIN role can't be suspended, terminated or have their role changed.
- **Closed projects take no new work** — no new tasks, reassignments or hours on completed or cancelled projects.
- **Hours are sane** — no future dates, at most 24 h per day in total, and only `PENDING` logs can be edited.
- **Payroll can't double-pay** — one payroll per employee per period, no overlapping periods, only approved payroll can be paid, and paid payroll can't be paid again.
- **History is kept** — departments, roles, projects and tasks are soft-deleted; "deleting" an employee terminates them. Recreating a deleted department or role with the same name restores it.

Every rule, state machine and edge case is in [WORKFLOW.md](./WORKFLOW.md).

---

## Security

- **Tokens in httpOnly cookies** — access token (24 h) and refresh token (7 days); `SameSite=None`, `Secure` in production. A `Bearer` header is also accepted (Postman).
- **Instant revocation** — changing the password bumps `tokenVersion`, which invalidates every existing token.
- **Status checked on every request** — blocked, deleted or terminated users are rejected even with a valid token. Permissions are loaded fresh per request, so role changes apply immediately.
- **Rate limits** — 300 requests / 15 min on `/api`, counted **per signed-in user** (anonymous traffic per IP); and 20 / 15 min on login, register and change-password, counted **per email**. Per-user/per-email keys matter because the frontend forwards all API traffic through its own server, so every request can arrive from the same IP — per-IP limits would lump all users together.
- **Validated input** — every write body passes a Zod schema; unknown fields are stripped.
- **Stripe** — webhook signatures are verified; completing a payment is idempotent (webhook and verify call can both run safely).
- **Helmet** headers and a CORS allow-list limited to `FRONTEND_URL`.

---

## Deployment

The API runs on **Vercel** (`vercel.json` serves the prebuilt `dist/server.js`). `dist/` isn't committed, so build locally and deploy with the Vercel CLI:

```bash
npm run build
vercel --prod
```

Then, in the Vercel project:

1. Set every variable from the [environment table](#2-configure-environment) (`NODE_ENV=production`, `APP_URL` and `FRONTEND_URL` = the live frontend URL).
2. Run migrations against the production database: `npx prisma migrate deploy --config prisma7.config.ts`.
3. In the Stripe dashboard, add a webhook to `https://<your-api>/api/v1/payments/webhook` for `checkout.session.completed`, `checkout.session.async_payment_failed` and `payment_intent.payment_failed`, and set its secret as `STRIPE_WEBHOOK_SECRET`.

> [!IMPORTANT]
> Put the function in the same region as the database (the demo database is in Singapore, so `sin1`). The default US region adds ~230 ms to every query.

---

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | Bundle to `dist/` with `tsup` |
| `npm start` | Run the built server |
| `npm run seed:demo` | Create the demo organization and 4 demo accounts |
| `npm run seed:demo:force` | Wipe and recreate the demo organization |
| `npm run stripe:webhook` | Forward Stripe events to the local server |
| `npm run lint:check` / `lint:fix` | Biome lint |
| `npm run format:check` / `format:fix` | Biome format |

---

## Project structure

```text
EmNex-Backend/
├── prisma/
│   ├── schema/            # one .prisma file per model + enums
│   └── migrations/
├── prisma7.config.ts      # Prisma CLI config (schema path, migrations, DATABASE_URL)
├── scripts/seed-demo.ts   # demo org + accounts
├── src/
│   ├── server.ts          # starts the server, runs the permission/role seed
│   ├── app.ts             # middleware, routes, error handlers
│   ├── scripts/           # demo data + one-off data migrations
│   └── app/
│       ├── config/        # typed env
│       ├── lib/           # Prisma, Stripe, Cloudinary, Google, mail clients
│       ├── middleware/    # auth, permission checks, validation, errors
│       ├── module/        # 12 feature modules (route → controller → service)
│       ├── templates/     # EJS email templates
│       └── utils/         # AppError, sendResponse, audit log, JWT, seed
└── EmNex Backend.postman_collection.json
```

---

## Further documentation

| Document | Covers |
| :--- | :--- |
| [POSTMAN.md](./POSTMAN.md) | **Automated Postman test suite guide**: 82 endpoints, token capture, 4 demo logins, and runbook |
| [API_INTEGRATION.md](./API_INTEGRATION.md) | All endpoints: permissions, request bodies, responses, errors, pagination |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Module pattern, request pipeline, auth and permission middleware, error handling, audit log, permission catalog |
| [DATABASE.md](./DATABASE.md) | ER diagram, every model and enum, constraints, soft deletes, migrations |
| [WORKFLOW.md](./workflow.md) | Sessions, onboarding, task / work-hours / payroll / payment flows and every business rule |
| [Postman collection](./EmNex%20Backend.postman_collection.json) | Complete JSON collection (82 endpoints) ready to import into Postman |

---

## Known limitations

- **Dashboard summary is tied to built-in roles.** `GET /analytics/dashboard` returns the admin, HR or finance summary based on the role *name*; any other role (including custom roles with `analytics.view`) gets the personal employee summary. The other analytics endpoints are fully permission-based.
- **Refunds aren't implemented.** The `payment.refund` permission and `REFUNDED` status exist but no endpoint uses them (the frontend hides the permission).
- **Stripe only.** `SSLCOMMERZ` and `BKASH` exist in the `PaymentGateway` enum for the future but aren't wired up.
- **Forced password change is enforced by the frontend.** The API marks new employees `mustChangePassword`, but doesn't block other requests until they change it.
- **Currency.** Checkout charges in USD; the `Payment.currency` column defaults to `BDT` for rows created outside checkout.
