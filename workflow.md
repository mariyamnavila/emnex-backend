<div align="center">

# 🔄 System Workflows & Data Pipelines

### *State Machines, Financial Pipelines & Authentication Lifecycle Diagrams*

[![Workflows](https://img.shields.io/badge/Workflows-Interactive-brightgreen?style=for-the-badge&logo=diagramsdotnet&logoColor=white)](#-authentication--token-lifecycle)
[![Mermaid](https://img.shields.io/badge/Mermaid.js-Enabled-ff69b4?style=for-the-badge&logo=mermaid&logoColor=white)](https://mermaid.js.org)

</div>

---

## 📌 Table of Contents

- [Authentication & Token Lifecycle](#-authentication--token-lifecycle)
- [Employee Lifecycle State Machine](#-employee-lifecycle-state-machine)
- [Project & Task Lifecycle](#-project--task-lifecycle)
- [Work Submission & Review Loop](#-work-submission--review-loop)
- [Automated Payroll & Stripe Payment Pipeline](#-automated-payroll--stripe-payment-pipeline)
- [Permission Resolution Chain](#-permission-resolution-chain)
- [Module Dependency Graph](#-module-dependency-graph)

---

## 🔑 Authentication & Token Lifecycle

EmNex uses a dual JWT authentication model with Access (24h) and Refresh (7d) tokens stored in HTTP-only cookies.

```mermaid
sequenceDiagram
    autonumber
    actor Client as 📱 Client App
    participant AuthAPI as 🔒 Auth Route
    participant JWT as 🔑 JWT Utilities
    participant DB as 🐘 PostgreSQL DB

    Note over Client, DB: Registration & Login Flow
    Client->>AuthAPI: POST /auth/login { email, password }
    AuthAPI->>DB: Query User by Email
    DB-->>AuthAPI: User Record + Hashed Password
    AuthAPI->>AuthAPI: Verify Bcrypt Hash
    AuthAPI->>JWT: Generate Access (24h) & Refresh (7d) Tokens
    JWT-->>AuthAPI: Encrypted Tokens
    AuthAPI-->>Client: 200 OK + Set-Cookie (accessToken, refreshToken)

    Note over Client, DB: Token Refresh Loop
    Client->>AuthAPI: POST /auth/refresh-token (Cookie: refreshToken)
    AuthAPI->>JWT: Verify Refresh Token Signature
    AuthAPI->>DB: Check User Status & tokenVersion
    alt tokenVersion Matches & User Active
        AuthAPI->>JWT: Generate New Access Token Pair
        AuthAPI-->>Client: 200 OK + Refreshed Cookies
    else Password Changed (tokenVersion Mismatch)
        AuthAPI-->>Client: 401 Unauthorized (Force Re-login)
    end
```

---

## 👥 Employee Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Hired: POST /employees (Create User + Employee)
    
    state Hired {
        [*] --> ACTIVE: Account Setup Completed
    }

    ACTIVE --> INACTIVE: Admin/HR Deactivates
    INACTIVE --> ACTIVE: Admin/HR Re-activates

    ACTIVE --> SUSPENDED: Disciplinary Action
    SUSPENDED --> ACTIVE: Suspension Lifted

    ACTIVE --> TERMINATED: Formal Termination
    INACTIVE --> TERMINATED: Formal Termination
    SUSPENDED --> TERMINATED: Formal Termination

    state TERMINATED {
        [*] --> Locked: Revoke Access & Tokens
    }

    Locked --> [*]
```

> [!CAUTION]
> **Admin Safeguard**: The system primary `ADMIN` account can **NEVER** be transitioned into `SUSPENDED`, `INACTIVE`, or `TERMINATED` states.

---

## 📁 Project & Task Lifecycle

```mermaid
stateDiagram-v2
    state Project_State {
        [*] --> PLANNED
        PLANNED --> ACTIVE: Start Project
        ACTIVE --> ON_HOLD: Pause Project
        ON_HOLD --> ACTIVE: Resume Project
        ACTIVE --> COMPLETED: All Tasks Done
        PLANNED --> CANCELLED: Cancel Project
        ACTIVE --> CANCELLED: Cancel Project
    }

    state Task_State {
        [*] --> TODO
        TODO --> IN_PROGRESS: Employee Starts Work
        IN_PROGRESS --> SUBMITTED: Work Hour Logged
        SUBMITTED --> APPROVED: Manager Approves Work
        SUBMITTED --> REJECTED: Manager Rejects Work
        REJECTED --> IN_PROGRESS: Employee Fixes & Resubmits
        APPROVED --> COMPLETED: Final Task Resolution
    }
```

---

## 📤 Work Submission & Review Loop

```mermaid
sequenceDiagram
    autonumber
    actor Employee as 👷 Employee
    actor Manager as 👔 HR / Admin Manager
    participant API as 🚀 EmNex API
    participant DB as 🐘 Database

    Employee->>API: POST /submissions { taskId, hoursWorked: 8, workDate }
    API->>DB: Create WorkSubmission (Status: PENDING)
    DB-->>Employee: 201 Created (Submission Pending)

    Manager->>API: GET /submissions?status=PENDING
    API-->>Manager: List of Pending Submissions

    alt Manager Approves Work
        Manager->>API: POST /submissions/:id/approve
        API->>DB: Update Status -> APPROVED
        DB-->>Manager: 200 OK (Approved)
        Note over DB: Submission now eligible for Payroll calculation
    else Manager Rejects Work
        Manager->>API: POST /submissions/:id/reject { reason: "Need detailed logs" }
        API->>DB: Update Status -> REJECTED + Store Review Note
        DB-->>Employee: Notification: Submission Rejected
        Employee->>API: POST /submissions (Resubmit revised hours)
    end
```

---

## 💵 Automated Payroll & Stripe Payment Pipeline

```mermaid
graph TD
    Sub[✅ Approved Work Submissions] --> Gen[⚙️ POST /payroll/generate]
    
    subgraph Payroll Service Math
        Gen --> CalcHours[Sum Approved Hours in Date Range]
        CalcHours --> SalaryCheck{Employee Salary Type?}
        SalaryCheck -->|HOURLY| HourlyMath[Gross = Total Hours × Hourly Rate]
        SalaryCheck -->|MONTHLY| MonthlyMath[Gross = Fixed Monthly Salary]
        HourlyMath --> NetCalc[Net Amount = Gross - Deductions]
        MonthlyMath --> NetCalc
    end
    
    NetCalc --> DraftPayroll[Draft Payroll Record Created]
    DraftPayroll --> ApprPayroll[👔 POST /payroll/:id/approve]
    
    ApprPayroll --> CreatePay[💳 POST /payments]
    CreatePay --> StripeSess[Stripe Checkout Session Created]
    StripeSess --> UserCheckout[🛒 Manager Completes Payment on Stripe]
    
    UserCheckout --> Webhook[⚡ POST /payments/webhook]
    Webhook --> VerifySig{Verify Stripe Signature?}
    VerifySig -->|Valid| UpdatePaid[Update Payment = COMPLETED & Payroll = PAID]
    VerifySig -->|Invalid| RejectWebhook[400 Bad Request]
```

---

## 🛡️ Permission Resolution Chain

```mermaid
graph TD
    ClientReq[📥 Incoming Request] --> AuthMw[🔑 auth Middleware]
    AuthMw --> ExtractToken[Extract & Verify JWT]
    ExtractToken --> LoadUser[Load User + Organization + Role]
    LoadUser --> FetchPerms[Load RolePermission Join Records]
    FetchPerms --> AttachUser[Attach req.user = { userId, role, permissions }]
    
    AttachUser --> PermMw[🔐 checkPermission Middleware]
    PermMw --> PermCheck{Does req.user.permissions contain ALL required perms?}
    PermCheck -->|YES| Next[✅ Proceed to Controller]
    PermCheck -->|NO| Forbidden[❌ 403 Forbidden Response]
```

---

## 🔗 Module Dependency Graph

```mermaid
graph TD
    Auth[🔑 Auth Module] --> Org[🏢 Organization Module]
    Auth --> Role[🛡️ Role Module]
    Role --> Perm[🔐 Permission Module]
    
    Org --> Dept[🏛️ Department Module]
    Org --> Emp[👥 Employee Module]
    Dept --> Emp
    
    Emp --> Proj[📁 Project Module]
    Proj --> Task[📋 Task Module]
    Emp --> Task
    
    Task --> Sub[📤 Submission Module]
    Emp --> Sub
    
    Sub --> Pay[💵 Payroll Module]
    Emp --> Pay
    
    Pay --> Pmt[💳 Payment Module]
    Emp --> Pmt
    
    Emp --> Audit[📜 Audit Log Module]
    Pmt --> Audit
```

---

[⬅️ Return to README.md](./README.md)
