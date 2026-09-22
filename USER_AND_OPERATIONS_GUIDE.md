# Photo Studio SaaS Platform — Complete User & Operations Guide

Welcome to the **Photo Studio SaaS Platform**. This document is the master operational handbook for developers, studio owners, photographers, and platform administrators. It details the complete architecture, feature set, SFTPGo and Immich integrations, end-to-end user workflows, and local/production deployment steps.

---

## 1. Platform Architecture & User Roles

The platform follows a clean **Multi-Tenant SaaS Architecture** built on Express.js (Node.js), React + Vite, PostgreSQL (Prisma 6), Redis, RabbitMQ, and self-hosted storage/gateway engines.

### The 3 Core Roles:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SUPER ADMIN LAYER                               │
│  - SaaS Business Management: Tenant Studio Provisioning                    │
│  - Quota & Billing Profile Allocation (Storage GiB & Camera Slots)          │
│  - Custom Billing Plans & Manual Invoice Adjustments                        │
│  - Platform-wide Usage Monitoring & Audit Logs                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                              STUDIO USER LAYER                              │
│  - Photography Pipeline: Events (Lead → Booked → ... → Delivered)           │
│  - Task Checklist Auto-Seeding & Milestone Completion                       │
│  - Custom Media Organization: Folder Tree & Bulk Item Move                  │
│  - Wireless Camera Sync: SFTPGo Account Management & Quotas                 │
│  - Hybrid Storage: Platform Billing + Studio-Owned S3/SFTP/FTP              │
│  - Album Management: Asset Selection, Cover Selection & Publication         │
│  - Client Management & Private Gallery Sharing (can_download/can_favorite)   │
│  - Studio Branding: Brand Name, Logo, Colors & Customer Portal Styling     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                            CUSTOMER / CLIENT LAYER                          │
│  - Private Branded Gallery Portal (`/customer/galleries`)                    │
│  - Real-time Live Camera Ingest Streaming (SSE Updates)                     │
│  - Photo Favoriting & Shortlist Curation                                    │
│  - Single Photo Download & Full Album ZIP Download                          │
│  - Bearer Public Link Viewing (`/shared/:token`)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SFTPGo & Wireless Camera Ingest Integration

The platform includes **SFTPGo REST API Integration** for camera management, automatic wireless uploads, and server-side webhook notification processing.

### A. How Camera Provisioning Works:
1. When a Studio Manager registers a new camera in `/studio/cameras`, the API verifies the studio's active camera slot quota.
2. The backend generates a secure password hash and calls `sftpgoService.provisionCameraUser()`.
3. If SFTPGo (`SFTPGO_HOST`) is active, it calls `/api/v2/users` via REST API to create/update an SFTPGo account bound to `/storage/<studio_slug>/cameras/<username>`.
4. If SFTPGo is offline or running locally without Docker, `sftpgoService` logs an operational note and enters **Resilient Fallback Mode**, ensuring development and testing are never blocked.
5. When a camera is retired in the UI, `sftpgoService.retireCameraUser()` revokes the user's SFTPGo transfer credentials while permanently retaining historical media records.

### B. SFTPGo Webhook Ingest Notification:
When a camera uploads a photo via SFTP, FTP, or WebDAV, SFTPGo dispatches an HTTP POST webhook to `/api/internal/ingest`:
- **Header**: `x-internal-token: <INTERNAL_SERVICE_KEY>`
- **Payload**:
  ```json
  {
    "username": "cam_lumina_r5",
    "filename": "IMG_0042.CR3",
    "virtual_path": "/cam_lumina_r5/IMG_0042.CR3",
    "file_size": 28450122,
    "event_id": "evt_992182"
  }
  ```
- **Backend Handler (`internalController.js`)**:
  1. Validates `x-internal-token` internal secret.
  2. Protects against duplicate event replays using `event_id` source keys.
  3. Derives the studio identity strictly from the authenticated camera upload username.
  4. Enforces platform storage quotas before accepting bytes.
  5. Creates asset records, updates camera `last_sync_at` timestamp, and emits a Server-Sent Event (SSE) to update the customer's live gallery instantly.

---

## 3. Immich Media Engine & Thumbnail Integration

Original photos are preserved intact in physical storage while **Immich** handles asset indexing and thumbnail previews.

### A. Media Processing Pipeline (`immichService.js`):
1. Upon upload completion, `mediaSyncWorker` calls `immichService.indexAssetInImmich()`.
2. Photos are indexed via Immich API (`/api/assets`), triggering thumbnail generation and EXIF metadata extraction.
3. If `IMMICH_API_KEY` is not set or Immich is offline, `immichService` generates a crisp, styled **SVG/Canvas Placeholder Thumbnail Stream** so UI cards and customer galleries display immediately without broken images.

---

## 4. End-to-End User Workflows

### Workflow A: Super Admin Provisioning a New Studio
1. Log in at `/login` using Super Admin credentials.
2. Navigate to **Studios** (`/admin/studios`).
3. Click **Provision Studio** and fill in Studio Name, Slug, Owner Email, Storage Quota (GiB), and Camera Limit.
4. The system initializes the tenant, provisions default branding, creates the billing profile, and registers audit logs.

### Workflow B: Studio Manager Pipeline & Shoot Management
1. Log in at `/login` as Studio Owner or Manager.
2. Go to **Events & Shoots** (`/studio/events`).
3. Click **New Event** and specify shoot title, shoot type (e.g. Wedding, Portrait), date, location, and creative direction.
4. The backend automatically seeds checklist tasks from `event_task_templates` for that shoot type.
5. Open the shoot detail page (`/studio/events/:id`) to advance the workflow stage (`Lead` → `Booked` → `Scheduled` → `Shooting` → `Editing` → `Review` → `Delivered` → `Archived`), toggle completed checklist items, and record transition notes.

### Workflow C: Custom Folder Organization & Camera Wireless Upload
1. Go to **Folders** (`/studio/folders`) to organize photos into custom folder trees.
2. Click **New Folder** to create sub-folders with custom branding colors.
3. Go to **Cameras** (`/studio/cameras`) and click **Register Camera**.
4. Enter the camera name, upload username, and password. The system provisions the SFTPGo user and provides connection details (Host, Port 22/21, Username, Password).
5. Photos uploaded by the camera appear in the folder library and auto-sync with active shoots.

### Workflow C.1: Connecting an External SFTP Server & Testing Camera Ingest
If your studio owns an external SFTP/FTP/S3 server (e.g. AWS S3, Wasabi, MinIO, or an external Linux SFTP server):
1. Navigate to **Storage Connections** (`/studio/storage`).
2. Click **Add Storage Connection**.
3. Select **Studio-Owned** and choose backend **SFTP** (or FTP / S3).
4. Enter your external server details: Host IP/Domain, Port (e.g. 22), Username, Password, and Remote Root Path.
5. Click **Test Connection** — the system runs automated protocol probes (`connect`, `write`, `read`, `list`, `delete`) and displays green operational status when verified.
6. Mark this connection as default or select it when registering a new camera in **Cameras** (`/studio/cameras`).
7. When your camera or SFTP client uploads photos to SFTPGo, the backend automatically transfers the files directly to your external SFTP server, indexes the photo in the Studio Library, and streams real-time updates to connected clients.

### Workflow D: Album Creation & Customer Gallery Delivery
1. Go to **Folders** or **Customers** (`/studio/customers`).
2. Create an album (`/studio/albums`), select assets, set a cover photograph, and mark it `is_published: true`.
3. In **Customers** (`/studio/customers`), click **Share Album**.
4. Select the client, toggle **Can Download** and **Can Favorite** permissions, and submit.
5. The customer receives an email notification with their private gallery link.

### Workflow E: Customer / Client Gallery Experience
1. Customer logs in at `/login` or opens their private gallery link (`/customer/galleries` or `/gallery/:albumId`).
2. They view their custom-branded photo gallery with studio colors and logo.
3. As the photographer shoots on location, new photographs appear instantly via live SSE tethering updates.
4. Customers can click the **Heart** icon to favorite photos into a shortlist.
5. Customers can click **Download Photo** or **Download Album ZIP** (`/customer/albums/:albumId/download`) to download all high-resolution files.

---

## 5. Running the Application & Test Matrix

### Prerequisites
- Node.js v18+
- PostgreSQL v14+ (or Docker Compose data stack)
- Redis v7+

### A. Environment Configuration (`.env`)
Ensure `.env` in root contains:
```env
PORT=5000
DATABASE_URL="postgresql://studio:studiopassword@localhost:5432/studiodb?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
SESSION_SECRET="your-super-secret-session-key"
INTERNAL_SERVICE_KEY="your-internal-service-secret"
STORAGE_ROOT_PATH="./storage"
SFTPGO_HOST="http://localhost:8080"
SFTPGO_ADMIN_USER="admin"
SFTPGO_ADMIN_PASSWORD="adminpassword"
IMMICH_URL="http://localhost:2283"
IMMICH_API_KEY=""
```

### B. Running Local Development
```bash
# Install dependencies
npm install

# Push database schema & seed initial data
npm run db:push
npm run db:seed

# Start backend API (Port 5000)
npm run dev:api

# Start frontend Web App (Port 5173)
npm run dev:web
```

### C. Running Automated Test Suite
To verify all 12 modules and E2E integration contracts:
```bash
npm --workspace=apps/api run test
```
All **9 Test Suites** (42 total test cases) pass with 100% success.

### D. Production Frontend & API Build
```bash
# Build API
npm run build:api

# Build Web Frontend
npm run build:web
```

---

## 6. Docker Container Orchestration

The platform includes modular Docker Compose configurations in `compose/`:
- `compose/data.yml`: PostgreSQL 16 & Redis 7.
- `compose/media.yml`: SFTPGo transfer gateway & Immich media engine.
- `compose/app.yml`: Express API container & Nginx web frontend.

To spin up full infrastructure:
```bash
docker compose -f compose/data.yml -f compose/media.yml up -d
```
