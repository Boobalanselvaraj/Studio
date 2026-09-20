# Photo Studio SaaS Platform — Comprehensive Setup & User Guide

A complete, beginner-friendly guide covering everything from initial installation to daily operational workflows for **Super Admins**, **Studio Owners & Photographers**, and **Customers**.

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Quick Prerequisites](#2-quick-prerequisites)
3. [Step-by-Step Setup from Scratch](#3-step-by-step-setup-from-scratch)
4. [Default Seed Credentials](#4-default-seed-credentials)
5. [Role-by-Role User Walkthrough](#5-role-by-role-user-walkthrough)
   - [A. Super Admin Portal (`/admin/*`)](#a-super-admin-portal-admin)
   - [B. Studio Portal (`/studio/*`)](#b-studio-portal-studio)
   - [C. Customer Portal (`/customer/*`)](#c-customer-portal-customer)
6. [Core Feature Deep Dives](#6-core-feature-deep-dives)
   - [Event & Shoot Workflow Management](#event--shoot-workflow-management)
   - [Studio-Custom Folder Hierarchy & Tags](#studio-custom-folder-hierarchy--tags)
   - [Camera Gateway (SFTPGo) & Wireless Ingest](#camera-gateway-sftpgo--wireless-ingest)
   - [White-Label Dynamic Branding Engine](#white-label-dynamic-branding-engine)
   - [Storage-Gated Billing & Quota Monitor](#storage-gated-billing--quota-monitor)
7. [API & Background Services Reference](#7-api--background-services-reference)
8. [Useful NPM & Docker Commands](#8-useful-npm--docker-commands)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. System Overview & Architecture

The **Photo Studio SaaS Platform** is a multi-tenant cloud application designed specifically for professional photography studios. It eliminates generic file-dump folders by providing:
- **Full Shoot Lifecycle Tracking**: Lead &rarr; Booked &rarr; Scheduled &rarr; Shooting &rarr; Editing &rarr; Review &rarr; Delivered &rarr; Archived.
- **Studio-Custom Hierarchical Folders**: Recursive file-explorer tree customized per studio.
- **Hardware Camera Connectivity**: Direct wireless upload from Wi-Fi cameras via SFTPGo.
- **White-Labeled Customer Portals**: Dynamic studio logo, colors, and Light/Dark themes.
- **Storage-Gated Metering**: Zero charge for studio-owned storage; automated billing for platform-hosted storage.

```
                                  [ Browser / Mobile Client ]
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │    Vite React Frontend (3000)  │
                              │  - Super Admin Portal          │
                              │  - Studio Workspace Portal     │
                              │  - Customer Branded Gallery    │
                              └────────────────┬───────────────┘
                                               │ HTTP / REST
                                               ▼
                              ┌────────────────────────────────┐
                              │   Express Backend API (4000)   │
                              │  - Functional Controllers      │
                              │  - JWT & Redis Session Auth    │
                              │  - Tenant Isolation (studio_id)│
                              └───────┬────────┬───────┬───────┘
                                      │        │       │
             ┌────────────────────────┘        │       └────────────────────────┐
             ▼                                 ▼                                ▼
    ┌────────────────┐                ┌────────────────┐               ┌────────────────┐
    │ PostgreSQL 16  │                │    Redis 7     │               │  RabbitMQ 3.13 │
    │ (Prisma 6 DB)  │                │ (Session Store)│               │ (Async Queues) │
    └────────────────┘                └────────────────┘               └────────────────┘
             │                                                                  │
             ▼                                                                  ▼
    ┌────────────────┐                                                 ┌────────────────┐
    │  Prisma Studio │                                                 │ Background     │
    │ (Web DB Admin) │                                                 │ Worker Engine  │
    └────────────────┘                                                 └────────────────┘
```

---

## 2. Quick Prerequisites

Make sure you have the following installed on your machine:
1. **Node.js**: `v18.x`, `v20.x`, or `v22.x` (check with `node -v`).
2. **Docker Desktop**: Running and healthy (check with `docker ps`).
3. **Git**: Installed for version control.

---

## 3. Step-by-Step Setup from Scratch

Follow these 4 simple steps to run the complete platform:

### Step 1: Clone and Install Dependencies
```bash
# Navigate to project directory
cd "e:\Existing\Studio App"

# Install all workspace dependencies (root, backend, and frontend)
npm install
```

### Step 2: Start Infrastructure Containers
Start PostgreSQL, Redis, RabbitMQ, and SFTPGo in Docker:
```bash
npm run compose:data
```
*(Optionally run `npm run compose:media` for Immich / SFTPGo media engine).*

### Step 3: Initialize & Seed Database
Push the Prisma 6 database schema and populate initial test data:
```bash
# Push database tables to PostgreSQL
npm run db:push

# Seed default Super Admin, test Studio, events, and customer
npm run db:seed
```

### Step 4: Launch Dev Servers
Open two terminal windows (or run in background):

**Terminal 1 (Backend API on Port 4000):**
```bash
npm run dev:api
```

**Terminal 2 (Frontend React App on Port 3000):**
```bash
npm run dev:web
```

---

## 4. Default Seed Credentials

After running `npm run db:seed`, use these pre-configured accounts:

| Role | Email | Password | Access Portal |
|---|---|---|---|
| **Super Admin** | `admin@photostudio.io` | `admin123456` | `http://localhost:3000/admin/dashboard` |
| **Studio Owner** | `owner@lumina.com` | `studio123456` | `http://localhost:3000/studio/dashboard` |
| **Client / Customer** | `sarah.client@example.com` | `customer123456` | `http://localhost:3000/customer/galleries` |

---

## 5. Role-by-Role User Walkthrough

### A. Super Admin Portal (`/admin/*`)
*Used by the platform owner to manage studio subscriptions, storage quotas, and system health.*

1. **Accessing the Portal**:
   - Navigate to `http://localhost:3000/admin/dashboard`.
   - View high-level metrics across all tenants (Total Studios, Active Events, Total Customers, Platform Storage).
2. **Onboarding a New Studio**:
   - Go to **Studios** &rarr; click **+ Add New Studio**.
   - Enter Studio Name (e.g. *Apex Visuals*), unique subdomain slug (`apex`), and initial storage quota (e.g., `100 GB`).
   - The platform automatically provisions:
     - Tenant record in `studios`.
     - Default branding tokens (`#3B82F6` primary color) in `studio_branding`.
     - Billing profile with quota hard cap in `studio_billing_profile`.
3. **Managing Storage Plans & Quotas**:
   - Go to `http://localhost:3000/admin/billing-plans`.
   - Create or adjust global storage pricing tiers (e.g. *Starter 50GB*, *Pro 200GB*).
   - Apply custom monthly pricing or storage quota overrides per studio.

---

### B. Studio Portal (`/studio/*`)
*Used by photography studio owners, managers, and photographers for daily shoot operations.*

1. **Studio Dashboard (`/studio/dashboard`)**:
   - View pending shoots, active events count, connected cameras, and pending task checklists.
2. **Event & Shoot Management (`/studio/events`)**:
   - **Kanban Board View**: Drag and drop shoot cards across columns:
     `Lead` &rarr; `Booked` &rarr; `Scheduled` &rarr; `Shooting` &rarr; `Editing` &rarr; `Review` &rarr; `Delivered`.
   - **Creating a Shoot**: Click **+ New Event**, choose event type (*Wedding*, *Portrait*, *Corporate*), pick dates, and assign customers.
   - **Task Checklists**: Add shoot checklists (*Backup SD cards*, *Cull raw frames*, *Color grading*, *Export deliverables*).
   - **Calendar View**: View month/year schedules to avoid double-booking photographers.
3. **Custom Folder Explorer (`/studio/folders`)**:
   - Create custom hierarchical folders (e.g. `2026 Shoots` &rarr; `Weddings` &rarr; `Ceremony`).
   - Assign custom folder colors and icons.
   - Organize assets, events, and albums within folder trees.
4. **Camera Setup & Wireless Ingest (`/studio/cameras`)**:
   - Click **+ Add Camera** (e.g. *Sony A7 IV - Cam 1*).
   - Enter dedicated SFTP credentials.
   - Configure camera Wi-Fi / FTP to automatically push photos directly to the studio's storage.
5. **Branding & Theme Customization (`/studio/branding`)**:
   - Change your brand name, upload your studio logo, and choose custom brand colors.
   - Preview in real-time how your customer galleries look in both **Light Mode** and **Dark Mode**.
6. **Storage & Metered Billing (`/studio/billing`)**:
   - Monitor storage quota usage (e.g. *32.5 GB of 100 GB used*).
   - Receive automatic alerts when reaching 80% or 100% capacity.
   - Submit 1-click quota upgrade requests.

---

### C. Customer Portal (`/customer/*`)
*Used by photography clients (couples, models, corporate clients) to view and download their private photos.*

1. **Client Login**:
   - Clients visit `http://localhost:3000/customer/galleries` and log in with their email.
2. **Branded Gallery Experience**:
   - The entire gallery dynamically reflects the **hiring studio's brand colors and logo** (never platform defaults).
   - Clients can switch between **Light and Dark themes** according to their preference.
3. **Interactive Features**:
   - **Masonry Photo Grid**: Clean responsive layout optimized for mobile and desktop.
   - **Lightbox Preview**: Full-screen high-resolution photo viewer.
   - **Favorites & Selection**: Mark favorite photos for album printing.
   - **Download**: Download individual photos or full gallery ZIPs.

---

## 6. Core Feature Deep Dives

### Event & Shoot Workflow Management
Every shoot follows an explicit state transition machine:
```
  Lead ──► Booked ──► Scheduled ──► Shooting ──► Editing ──► Review ──► Delivered ──► Archived
    │         │           │            │           │          │
    └─────────┴───────────┴────────────┴───────────┴──────────┴────► Cancelled
```
- Every transition automatically records an entry in `event_status_history` with the user ID, timestamp, and optional transition note.
- Background jobs in `eventAutomationWorker.js` handle automated reminder notifications and deadline alerts.

### Storage-Gated Billing & Quota Monitor
- **Platform-Hosted Storage** (`provider_type = 'platform'`): Metered daily, counted against the studio's `storage_quota_gb`, and billed on monthly tier invoices.
- **Studio-Owned Storage** (`provider_type = 'studio_owned'`): Excluded from platform billing — studios connect their own S3/NAS/SFTP free of storage charges.
- **Credential Encryption**: All storage credentials and S3 keys are encrypted at rest with **AES-256-GCM** using `CREDENTIAL_ENCRYPTION_KEY`.

---

## 7. API & Background Services Reference

### Key API Endpoints (`http://localhost:4000/api`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service uptime and health check |
| `POST` | `/api/auth/login` | Authenticate user & return JWT/session |
| `GET` | `/api/studio/events` | List studio events with filters |
| `POST` | `/api/studio/events/:id/status` | Advance event workflow status |
| `GET` | `/api/studio/events/calendar` | Get month-by-month calendar view |
| `GET` | `/api/studio/folders/tree` | Fetch recursive custom folder tree |
| `POST` | `/api/studio/folders/bulk-move` | Asynchronously move folder items |
| `GET` | `/api/studio/branding` | Fetch studio brand tokens & colors |
| `PUT` | `/api/studio/branding` | Update dynamic brand colors & logo |
| `GET` | `/api/studio/billing/usage` | Get live storage used vs. quota GB |
| `GET` | `/api/customer/albums` | Get client's private shared galleries |
| `GET` | `/api/admin/studios` | List all platform studios (Super Admin) |

### Background Queue Consumers (`apps/api/src/queues/`)
- `mediaSyncWorker.js`: Handles async thumbnail extraction and Immich asset indexing.
- `eventAutomationWorker.js`: Handles shoot workflow auto-transitions and deadline reminders.
- `billingMeteringWorker.js`: Computes daily storage usage snapshots and generates invoices.
- `notificationWorker.js`: Routes email and SMS client notifications.

---

## 8. Useful NPM & Docker Commands

| Command | Action |
|---|---|
| `npm run dev:api` | Start backend API with hot-reload (`nodemon`) |
| `npm run dev:web` | Start frontend React application (`vite`) |
| `npm run db:push` | Sync Prisma schema to PostgreSQL database |
| `npm run db:seed` | Seed database with sample admin, studio & customer |
| `npm run db:studio` | Launch visual Prisma Studio database GUI |
| `npm run compose:data` | Start PostgreSQL, Redis, and RabbitMQ containers |
| `npm run compose:down` | Stop and tear down all Docker containers |
| `npm run compose:logs` | View live streaming logs from Docker containers |

---

## 9. Troubleshooting & FAQs

#### Q1: "Authentication failed against database server" when running `npm run db:push`
- **Cause**: On Windows machines with a native PostgreSQL service installed, port `5432` may conflict.
- **Solution**: The Docker PostgreSQL container is mapped to port `5434` (`localhost:5434`). Ensure your `.env` contains `DB_PORT=5434` and `DATABASE_URL=postgresql://postgres:postgres_secure_password@localhost:5434/photo_studio_db`.

#### Q2: How can I visually browse the database tables?
- Run `npm run db:studio`.
- Open `http://localhost:5555` in your browser to inspect and edit all database rows visually.

#### Q3: Where do uploaded camera photos get stored?
- Photo files are stored in the storage provider configured for the studio (`/var/data/studio-storage` for local disk, or the studio's connected S3/SFTP bucket). Raw photo binaries are never stored inside the PostgreSQL database.

---

*Enjoy building with Photo Studio SaaS Platform!*
