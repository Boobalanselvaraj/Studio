> Current development specification: [Studio Platform Implementation Plan v4](STUDIO_PLATFORM_IMPLEMENTATION_PLAN.md). It includes the audited source gaps, all nine revised requirements, migration sequence and release acceptance gates. Planned capabilities are not a statement that the current implementation is complete.

# Photo Studio SaaS Platform (v3)

A high-performance, multi-tenant SaaS platform built for professional photography studios. Features complete **Event / Shoot Workflow Management**, **Studio-Custom Hierarchical Folder Organization**, **Per-Studio Metered Storage Billing**, and a self-hosted **Immich / SFTPGo** media pipeline.

> 📖 **Looking for the complete from-scratch guide?** Check out [**USER_AND_SETUP_GUIDE.md**](file:///e:/Existing/Studio%20App/USER_AND_SETUP_GUIDE.md) for full installation steps, seed credentials, role-by-role walkthroughs, and architecture details.

---

## 1. High-Level Architecture

```
                                   INTERNET
                                      │
                                      ▼
                              ┌──────────────┐
                              │    NGINX     │
                              │ TLS / Proxy  │
                              └──────┬───────┘
                                     │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
                   ▼                                   ▼
            React + Vite                          Express API
        (Admin / Studio / Customer)               Business Logic
                                                          │
        ┌──────────────────────────┬───────────────────┼───────────────────┬──────────────────────┐
        │                          │                    │                   │                      │
        ▼                          ▼                    ▼                   ▼                      ▼
   PostgreSQL                   Redis               RabbitMQ           SFTPGo                  Immich
  Platform DB              Cache/Sessions          Jobs/Events      File Transfer            Media Engine
        │                          │                    │            Gateway                (internal only)
        │                          │                    │                │                       │
        │                          │                    │                ▼                       │
        │                          │                    │        Studio Storage                  │
        │                          │                    │      (Local / SFTP / S3)                │
        │                          │                    │                │                       │
        │                          │                    └────────────────┴───────────────────────┘
        │                          │
        │                          │
        └──────────────┬───────────┘
                        │
                        ▼
              Event / Workflow Engine
        (status machine, tasks, notifications)
```

---

## 2. Repository Structure

```
photo-studio-platform/
├── apps/
│   ├── api/                            # Express Backend
│   │   ├── package.json
│   │   └── src/
│   │       ├── config/                 # DB, Redis, RabbitMQ, Storage configs
│   │       ├── controllers/            # Route controllers
│   │       ├── middlewares/            # Auth, Tenant isolation, RBAC
│   │       ├── routes/                 # Express route definitions
│   │       ├── services/               # Business logic (Workflow, Folders, Billing, etc.)
│   │       ├── repositories/           # Studio-isolated database access layer
│   │       ├── queues/                 # RabbitMQ background workers
│   │       └── server.js               # Application bootstrap
│   └── web/                            # React + Vite Frontend
│       ├── package.json
│       ├── vite.config.js
│       ├── tailwind.config.js
│       └── src/
│           ├── api/                    # Axios API client instance
│           ├── components/
│           │   ├── ui/                 # Accessible Radix/Tailwind components
│           │   ├── event-kanban/       # Shoot workflow Kanban board
│           │   ├── folder-tree/        # Recursive folder explorer
│           │   └── gallery/            # Branded customer gallery grid
│           ├── layouts/                # Admin, Studio, Customer, Auth layout shells
│           ├── pages/                  # Route views (Dashboard, Events, Folders, Billing, etc.)
│           ├── stores/                 # Zustand stores
│           ├── theme/                  # Design tokens, ThemeProvider, BrandColorInjector
│           └── App.jsx                 # Master application router
├── infrastructure/
│   ├── postgres/init/                  # Initial multi-tenant schema DDL
│   ├── nginx/                          # Reverse proxy & TLS config
│   ├── redis/                          # Redis cache & session config
│   ├── rabbitmq/                       # Queue & exchange definitions
│   ├── sftpgo/                         # Camera upload gateway config
│   ├── immich/                         # Internal media engine setup
│   └── piwigo/                         # Isolated evaluation stack
├── compose/
│   ├── app.yml                         # API, Web, and Nginx containers
│   ├── data.yml                        # PostgreSQL, Redis, RabbitMQ
│   └── media.yml                       # SFTPGo, Immich, Piwigo
├── docker/                             # Container build recipes
├── docker-compose.yml                  # Unified Compose entry point
├── .env.example                        # Comprehensive environment template
├── .gitignore
└── README.md
```

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 + Vite |
| **Styling & Design System** | Tailwind CSS + CSS Variable Design Tokens |
| **UI Components** | Radix UI Primitives (shadcn/ui style) + Lucide Icons |
| **Backend Framework** | Node.js + Express |
| **Database** | PostgreSQL 16 (Logical multi-tenancy via `studio_id`) |
| **Cache & Sessions** | Redis 7 (`connect-redis`) |
| **Async Queues** | RabbitMQ 3.13 (`amqplib`) |
| **File Transfer Gateway** | SFTPGo (isolated per-camera SFTP credentials) |
| **Media Engine** | Immich (Internal proxy only) |
| **Reverse Proxy** | Nginx |

---

## 4. Phased Build Order (Backend-First)

1. **Phase 1**: Infrastructure (Postgres, Redis, RabbitMQ, SFTPGo, Immich, Nginx)
2. **Phase 2**: Express foundation (DB connections, Auth sessions, Tenant & RBAC middlewares)
3. **Phase 3**: Studio Management (Super Admin studio onboarding & provisioning)
4. **Phase 4**: Storage Provider Configuration (Platform vs. Studio-Owned S3/NAS + AES-256 encryption)
5. **Phase 5**: Camera Gateway (SFTPGo camera user provisioning & upload paths)
6. **Phase 6**: Media Sync Pipeline (Upload → RabbitMQ → Immich indexing)
7. **Phase 7**: Studio-Custom Folders (Self-referencing tree, drag-drop move jobs, tagging)
8. **Phase 8**: Event & Shoot Management (Status state machine, checklists, reminders)
9. **Phase 8.5**: Metered Billing (Storage snapshots, platform storage quotas, invoice generation)
10. **Phase 9**: Branding & Customer Accounts (White-label injection, private gallery login)
11. **Phase 10–14**: Frontend Application (Theme system, Studio Portal, Customer Portal, Super Admin)

---

## 5. Quickstart & Development

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Start Infrastructure Services
```bash
# Start PostgreSQL, Redis, RabbitMQ, SFTPGo, and Immich
docker compose -f compose/data.yml -f compose/media.yml up -d
```

### 3. Run Backend API Locally
```bash
cd apps/api
npm install
npm run dev
```

### 4. Run Frontend Locally
```bash
cd apps/web
npm install
npm run dev
```

---

## 6. Pushing to Remote Git Repository

To connect this initialized repository to GitHub / GitLab and share with your team:

```bash
# 1. Add your remote repository
git remote add origin <YOUR_GIT_REPO_URL>

# 2. Push initial commit to main branch
git branch -M main
git push -u origin main
```

