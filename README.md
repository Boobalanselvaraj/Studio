# Photo Studio SaaS Platform

A multi-tenant cloud platform built for professional photography studios. It combines complete shoot lifecycle tracking, customizable recursive folder trees, wireless Wi-Fi camera upload ingest via SFTPGo, white-labeled client galleries, and metered storage billing.

---

## 1. Architecture Overview

```
                                [ Web Browser / Mobile ]
                                           │
                                           ▼
                            ┌──────────────────────────────┐
                            │   Frontend (React + Vite)    │
                            │   Port: 3000                 │
                            └──────────────┬───────────────┘
                                           │ HTTP / REST
                                           ▼
                            ┌──────────────────────────────┐
                            │    Backend (Node + Express)  │
                            │    Port: 4000                │
                            └──────┬───────┬───────┬───────┘
                                   │       │       │
             ┌─────────────────────┘       │       └─────────────────────┐
             ▼                             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ External / Host Postgres│   │         Redis 7         │   │      RabbitMQ 3.13      │
│ (Your PostgreSQL DB)    │   │ (Cache & Session Store) │   │ (Async Queues & Events) │
│ Port: 5432              │   │ Port: 6379              │   │ Ports: 5672, 15672      │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │      SFTPGo Gateway     │
                              │ (Direct Camera Ingest)  │
                              │ Ports: 2022, 8080       │
                              └─────────────────────────┘
```

---

## 2. Directory Structure

```
Studio/
├── apps/
│   ├── backend/               # Express.js REST API & Prisma 6 ORM
│   │   ├── prisma/            # Database schema & seed scripts
│   │   ├── src/               # Controllers, routes, queues, services
│   │   ├── Dockerfile         # Standalone backend container image
│   │   └── package.json
│   ├── frontend/              # React 18 + Vite + Tailwind CSS SPA
│   │   ├── src/               # Admin, Studio, and Customer portals
│   │   ├── Dockerfile         # Standalone frontend container image
│   │   └── package.json
│   └── docker-compose.yml     # Unified compose file for backend + frontend
├── infrastructure/
│   ├── rabbitmq/              # RabbitMQ configuration & queue definitions
│   ├── redis/                 # Redis configuration
│   ├── sftpgo/                # SFTPGo gateway settings
│   └── docker-compose.yml     # Infrastructure services (Redis, RabbitMQ, SFTPGo)
├── storage/                   # Local file & camera ingest directory
├── .env                       # Environment variables
├── .env.example               # Environment variables template
├── docker-compose.yml         # Umbrella compose file (includes apps + infrastructure)
└── package.json               # Root workspace scripts & orchestrations
```

---

## 3. Quick Start & Setup Guide

### Step 1: Configure Environment Variables
Copy `.env.example` to `.env` if not already present:
```powershell
cp .env.example .env
```

Set your **External or Host PostgreSQL** connection string in `.env`:
```env
# For Local Node.js development:
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<dbname>

# For Docker containers connecting to Host Postgres (Windows/Mac):
DATABASE_URL=postgresql://<user>:<password>@host.docker.internal:5432/<dbname>

# For Remote/Cloud PostgreSQL:
DATABASE_URL=postgresql://<user>:<password>@<remote-host>:5432/<dbname>?sslmode=require
```

---

### Step 2: Start Infrastructure Services
Start Redis, RabbitMQ, and SFTPGo in Docker:
```powershell
npm run infra:up
```
*(To stop infrastructure: `npm run infra:down`)*

---

### Step 3: Initialize Database Schema & Seed Data
Push the Prisma database schema into your external PostgreSQL and populate default test accounts:
```powershell
# Push schema tables to your PostgreSQL database
npm run db:push

# Populate default Super Admin, Studio, Events, and Customer data
npm run db:seed
```

*(Optional: Run `npm run db:studio` to open Prisma Studio web DB browser).*

---

### Step 4: Run Application

#### Option A: Local Development (Recommended)
Open two separate terminal windows:

- **Terminal 1 (Backend API):**
  ```powershell
  npm run dev:backend
  ```
  *Runs on [http://localhost:4000](http://localhost:4000)*

- **Terminal 2 (Frontend UI):**
  ```powershell
  npm run dev:frontend
  ```
  *Runs on [http://localhost:3000](http://localhost:3000)*

#### Option B: Docker Containers
To run both backend and frontend inside containers:
```powershell
npm run apps:up
```
*(To stop apps: `npm run apps:down`)*

Or to start everything (infrastructure + apps) together:
```powershell
npm run compose:up
```

---

## 4. Default Seed Credentials

After running `npm run db:seed`, sign in with these pre-configured accounts:

| Portal | Email | Password | URL |
|---|---|---|---|
| **Super Admin** | `admin@photostudio.io` | `admin123456` | [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard) |
| **Studio Owner** | `owner@lumina.com` | `studio123456` | [http://localhost:3000/studio/dashboard](http://localhost:3000/studio/dashboard) |
| **Customer** | `sarah.client@example.com` | `customer123456` | [http://localhost:3000/customer/galleries](http://localhost:3000/customer/galleries) |

---

## 5. NPM Script Reference

| Command | Action |
|---|---|
| `npm run dev:backend` | Start Express backend in development mode (`nodemon`) |
| `npm run dev:frontend` | Start React frontend in development mode (`vite`) |
| `npm run build:backend` | Build / prepare Prisma for backend |
| `npm run build:frontend` | Build frontend production bundle (`vite build`) |
| `npm run test:backend` | Run backend test suites (`jest`) |
| `npm run db:generate` | Generate Prisma 6 Client |
| `npm run db:push` | Push schema changes directly to external PostgreSQL |
| `npm run db:seed` | Seed default users, plans, studios, and events |
| `npm run db:studio` | Launch Prisma Studio GUI browser |
| `npm run infra:up` | Start Redis, RabbitMQ & SFTPGo containers |
| `npm run infra:down` | Stop infrastructure containers |
| `npm run apps:up` | Start backend & frontend containers |
| `npm run apps:down` | Stop backend & frontend containers |
| `npm run compose:up` | Start all services (infrastructure + apps) |
| `npm run compose:down` | Stop all services |
