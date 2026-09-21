> Superseded in part by [Studio Platform Implementation Plan v4](STUDIO_PLATFORM_IMPLEMENTATION_PLAN.md). For allocations, storage ownership, camera limits, WiFi, public gallery links, billing components and internal media integration, v4 is authoritative. The v3 login-only/no-token decision below is historical and no longer applies.

# Photo Studio SaaS Platform — Full Architecture & Build Plan (v3)

This document expands the original build plan with two major feature tracks the studios need:

1. **Event / Shoot Management** — a real workflow tool (booking → shoot → edit → delivery), not just a file dump.
2. **Studio-Custom Folder Organization** — each studio can structure their own albums/folders however they want, instead of a fixed hierarchy.

It also locks in the **UI system** (light/dark, component library) and confirms the build order: **backend fully first, then a fully modern frontend.**

Decisions carried over from v1, still locked:

- Custom domains per studio: reserved in schema, not implemented yet
- Customer access: login-required accounts (no token-only links)
- Media engine: Immich, fully hidden behind Express (Piwigo stays a separate evaluation track)
- Branding: every customer-facing screen renders the **studio's** logo/colors/name, never the platform's

New decisions locked in this version:

- Events are **first-class objects** with a status workflow, not just a folder label
- Folders/albums are **studio-defined trees**, not a fixed "Event → Album" hierarchy
- UI ships with a **theme system** (light/dark + per-studio brand color) from day one, using Tailwind + a component library, not hand-rolled CSS
- Build order is **backend-complete first** (all APIs, workflow logic, jobs, auth, storage, media pipeline), **then** frontend, so the UI is built once against a stable, fully working API — not evolved alongside a moving backend

---

## Table of Contents

- 1 — High-Level Architecture (expanded)
- 2 — Tech Responsibility Table (expanded)
- 3 — Feature Deep Dive — Event & Shoot Management
- 4 — Feature Deep Dive — Studio-Custom Folder Organization
- 5 — UI / UX System — Light & Dark Mode, done properly
- 6 — Updated Database Model (on top of v1 schema)
- 7 — Updated Repository Structure
- 8 — API Surface (new endpoints, on top of v1's CRUD)
- 9 — Backend-First Phased Build Order
- 10 — Tech Stack Summary
- 12 — Feature Deep Dive — Per-Studio Billing Management
- 13 — Roles & Permissions (RBAC)
- 14 — Security & Multi-Tenancy
- 15 — Non-Functional Requirements
- 16 — Glossary
- 17 — Next Step

---

## 1. High-Level Architecture (expanded)

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
        (status machine, tasks, notifications —
         lives inside Express + RabbitMQ, not a
         separate service in v1)

                ┌───────────────────────┐
                │       Piwigo          │
                │   Separate Evaluation │
                └───────────────────────┘
```

**Golden rule (unchanged):** the deployment server never stores studio media. Media lives in studio-configured storage; the platform only stores *configuration, workflow state, and business data*.

**What's new architecturally:**

- The **Event/Workflow Engine** is not a new infrastructure box — it's a set of services + a status-machine table living in Express/Postgres, driven by RabbitMQ for async steps (notifications, reminders, auto-transitions). Calling it out separately here because it's a first-class feature, not just CRUD.
- **Folders** become a generic, recursive structure owned by each studio (see §4), sitting between Events and Assets instead of a fixed Event→Album pairing.

---

## 2. Tech responsibility table (expanded)

| Layer | Responsibility |
|---|---|
| **React + Vite** | Renders 3 route-guarded zones (Admin / Studio / Customer); calls only Express REST API; renders studio branding + theme dynamically; no direct Immich/SFTPGo knowledge |
| **Nginx** | TLS termination, reverse proxy to React (static) and Express (`/api/`), blocks all internal service ports from public internet |
| **Express API** | Auth (cookie sessions), RBAC, tenant isolation, all CRUD, **event workflow engine**, **folder tree engine**, SFTPGo provisioning, Immich integration, asset proxying |
| **PostgreSQL** | Source of truth: users, studios, customers, cameras, storage config, branding, **events, event_tasks, event_status_history**, **folders, folder_items**, tags, albums/shares, audit logs |
| **Redis** | Sessions, rate limiting, caching, short-lived job/state lookups |
| **RabbitMQ** | Async jobs: thumbnailing, metadata extraction, Immich sync, notifications, **event reminders / auto status transitions**, **bulk folder move/reorganize jobs** |
| **SFTPGo** | File-transfer gateway; isolated per-camera/per-studio credentials |
| **Immich** | Internal media engine only — indexing, thumbnails, EXIF, face/object detection (used to power smart folders/tags) |
| **Piwigo** | Parallel, isolated evaluation stack |

---

## 3. Feature deep dive — Event & Shoot Management

Studios asked for something closer to what tools like Pixieset, ShootProof, and Pic-Time offer for shoot workflow, not just "upload photos, customer downloads." Below is the feature set to build, and how it maps to the backend.

### 3.1 Event lifecycle (status machine)

```
  Lead → Booked → Scheduled → Shooting → Editing → Ready for Review → Delivered → Archived
                                   │
                                   └──> Cancelled (from any state before Delivered)
```

- Every transition is recorded in `event_status_history` (who changed it, when, from/to, optional note).
- Some transitions can be **automatic**: e.g. when the last asset for an event is uploaded via SFTPGo/camera, auto-move `Scheduled → Shooting` (first asset) and flag "ready to move to Editing" once upload has been idle for N minutes (RabbitMQ delayed job).
- Studio users can define which transitions require manual confirmation vs. which are automatic, per studio (a simple config row, not a full workflow builder in v1).

### 3.2 Event object — what it holds

- Title, type (wedding / portrait / corporate / product / other — studio-configurable list), date(s), location
- Assigned photographer(s)/camera(s)
- Linked customer(s) (one event can be shared with multiple customers — e.g. wedding couple)
- Task checklist (see 3.3)
- Notes (internal, staff-only — never shown to customer)
- Delivery deadline + reminder schedule
- Linked folder tree (see §4) — where the actual media lives

### 3.3 Tasks & checklists

- Per-event checklist, either from a **studio-defined template** ("Wedding checklist": backup cards, cull, color grade, select favorites, export, upload, notify client) or ad hoc.
- Tasks have: title, assignee, due date, done/not-done, optional linked folder.
- Studio dashboard shows "My tasks today/this week" across all events — this is the single most requested feature from studios managing many shoots in parallel.

### 3.4 Calendar & timeline views

- Month/week calendar of all events (color-coded by status or event type).
- Per-camera/per-photographer calendar filter (avoid double-booking).
- Timeline/kanban view: columns = statuses, cards = events, drag card to change status (fires the same transition logic as the API, just via drag-drop in the UI).

### 3.5 Client-facing booking & questionnaire (phase 2 feature, scoped now so schema supports it later)

- Public booking request form (studio-branded) → creates a `Lead` event automatically.
- Pre-shoot questionnaire template per event type.
- Not built in Phase 1 backend pass, but `events.source = 'manual' | 'booking_form'` and a `event_questionnaire_responses` table are reserved in the schema now so this isn't a rework later.

### 3.6 Notifications

- RabbitMQ-driven: email (and later SMS) on status change, task due, delivery deadline approaching, customer gallery ready.
- Studio can customize which events trigger a notification and to whom (staff vs. customer).

### 3.7 Feature comparison (why these choices)

| Capability | Pixieset/ShootProof-style tools | This platform |
|---|---|---|
| Shoot status workflow | Yes, usually fixed stages | Yes, studio-configurable transitions |
| Task checklists per shoot | Limited/none in most | Yes, templated per event type |
| Multi-photographer calendar | Partial | Yes, per-camera/photographer filter |
| Custom folder structure per studio | No — fixed gallery model | Yes (see §4) |
| Self-hosted media engine | No (SaaS-locked) | Yes — Immich, studio owns storage |
| White-label branding | Paid tier feature | Built-in, per studio, from day one |

---

## 4. Feature deep dive — Studio-Custom Folder Organization

Instead of a rigid "Studio → Event → Album → Assets" structure, studios get a **folder tree they design themselves**, similar to a file explorer, with events and albums able to sit anywhere in it.

### 4.1 Model

- `folders` is a **self-referencing tree**: each folder has a `parent_folder_id` (nullable = root), belongs to a studio, has a name, sort order, and optional icon/color.
- `folder_items` links a folder to the things inside it: an event, an album, a sub-folder (implicit via parent_folder_id), or directly to assets for studios that don't want the Event/Album split at all.
- This means a studio can organize as:
  - `2026 / Weddings / Smith-Jones / Ceremony`, `Reception`, `Getting Ready` (folders all the way down), **or**
  - `Clients / Smith Family / 2026 Spring Session` (flat, by client, not by year), **or**
  - the default suggested structure (`Events → auto-created folder per event`) if they don't want to think about it.

### 4.2 Organization features

- **Drag-and-drop** move of folders, albums, and events between folders (bulk move supported, runs as a RabbitMQ job when moving large asset counts so the UI doesn't block).
- **Naming templates**: studio can define a pattern like `{event_date} - {event_title}` so new event folders auto-name themselves consistently.
- **Smart folders / saved filters**: e.g. "All events this month," "Unpaid invoices" (future), "Needs culling" — a saved query, not a real folder, but shown in the same tree UI with a distinct icon.
- **Tags**: free-form tags on events and assets (`tags`, `event_tags`, `asset_tags`), usable as an alternative/complement to folders (e.g. tag by photographer, by location, by season) — good for studios who prefer tag-based over strict hierarchy.
- **Bulk actions** at any folder level: move, delete (soft-delete with recovery window), re-share, re-brand, export.
- **Auto-tagging assist**: Immich's face/object detection results are surfaced as *suggested* tags — studio confirms before they're applied, never auto-applied silently.

### 4.3 Why this design

A fixed hierarchy is the #1 complaint studios have about existing tools — every studio organizes differently (by client, by year, by shoot type, by photographer). A self-referencing folder tree plus tags covers all of those without forcing a schema migration every time a studio's workflow differs from another's.

---

## 5. UI / UX System — Light & Dark Mode, done properly

### 5.1 Stack

- **Tailwind CSS** for utility styling + design tokens
- **shadcn/ui** (Radix-based) for accessible, themeable base components — buttons, dialogs, dropdowns, tables, tabs, calendar, kanban primitives
- **CSS variables** for all colors (never hard-coded hex in components) so both platform theme *and* per-studio brand color can layer on top of light/dark mode

### 5.2 Theme layers (important — two independent theme concerns)

1. **Light/Dark mode** — a global preference (system-detected by default, user-toggleable, stored per-user). Affects background/surface/text/border tokens.
2. **Studio branding** — primary/secondary brand color, logo, studio name. Only applies inside `/studio/*` and that studio's slice of `/customer/*`. Never overrides light/dark — brand color is computed to stay accessible (sufficient contrast) in both modes, e.g. by deriving a lighter/darker variant automatically rather than storing two separate colors the studio has to pick.

```
:root                    → light mode tokens (--bg, --surface, --text, --border, --muted)
.dark                    → dark mode token overrides
--brand-primary           → set at runtime per studio (CSS var injected from studio_branding)
--brand-primary-foreground→ computed for contrast, not stored
```

### 5.3 Core design tokens (starting set)

| Token | Purpose |
|---|---|
| `--bg` / `--surface` / `--surface-2` | Page background, card background, nested card background |
| `--text` / `--text-muted` | Primary and secondary text |
| `--border` | Dividers, card borders, input borders |
| `--brand-primary` / `--brand-primary-foreground` | Studio brand color + auto text-contrast color |
| `--success` / `--warning` / `--danger` / `--info` | Status colors (used heavily for event status badges) |
| `--radius` | Consistent corner radius across cards/buttons/inputs |

### 5.4 Key screens that need real design attention (not just CRUD forms)

- Event **kanban board** (status columns, drag-drop cards)
- Folder **tree explorer** (collapsible, drag-drop, breadcrumb)
- Customer **gallery grid** (masonry, lightbox, favorites, download) — fully studio-branded, respects visitor's light/dark preference
- Studio **dashboard** (today's tasks, upcoming shoots, storage usage, recent uploads)
- **Theme + branding settings** screen where studio picks brand color and previews it live in both light and dark

### 5.5 Accessibility & responsiveness baseline

- All interactive components keyboard-navigable (comes largely free with Radix/shadcn)
- Minimum AA contrast enforced by the token system, checked especially for studio brand colors against both light and dark surfaces
- Mobile-first layouts for the Customer Portal specifically — most customers view galleries on phones

---

## 6. Updated database model (on top of v1 schema)

```
events
----------------
id
studio_id
title
event_type              -- studio-configurable list, e.g. wedding/portrait/corporate
status                   -- lead/booked/scheduled/shooting/editing/review/delivered/archived/cancelled
source                   -- 'manual' | 'booking_form' (reserved)
event_date_start
event_date_end
location
delivery_deadline
created_by
created_at

event_status_history
----------------
id
event_id
from_status
to_status
changed_by               -- nullable if system/automatic
note
created_at

event_customers           -- which customers are linked to an event (supports multiple, e.g. couples)
----------------
id
event_id
customer_id

event_tasks
----------------
id
event_id
title
assignee_id
due_date
is_done
linked_folder_id          -- nullable
created_at

event_task_templates       -- studio-defined checklist templates per event_type
----------------
id
studio_id
event_type
title
sort_order

event_questionnaire_responses   -- reserved for booking-form phase 2
----------------
id
event_id
question_key
answer_text

folders
----------------
id
studio_id
parent_folder_id          -- nullable = root
name
sort_order
icon
color
naming_template            -- nullable, e.g. "{event_date} - {event_title}"
created_at

folder_items
----------------
id
folder_id
item_type                  -- 'event' | 'album' | 'asset'
item_id
sort_order

tags
----------------
id
studio_id
label
color

event_tags / asset_tags
----------------
id
tag_id
event_id / asset_id
source                      -- 'manual' | 'suggested' (from Immich detection, pre-confirmation)
```

Core tables unchanged from v1: `users, studios, studio_users, customers, cameras, storage_providers, storage_credentials, albums, assets, shares, sftpgo_accounts, immich_libraries, audit_logs, studio_branding, album_customers`.

---

## 7. Updated repository structure

```
photo-studio-platform/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── config/
│   │       ├── controllers/
│   │       ├── middlewares/            (auth, tenant, RBAC)
│   │       ├── routes/
│   │       ├── services/
│   │       │   ├── auth/
│   │       │   ├── studio/
│   │       │   ├── customer/
│   │       │   ├── camera/
│   │       │   ├── storage/
│   │       │   ├── sftpgo/
│   │       │   ├── immich/
│   │       │   ├── piwigo/
│   │       │   ├── branding/
│   │       │   ├── album/
│   │       │   ├── sharing/
│   │       │   ├── events/             (status machine, tasks, templates)
│   │       │   ├── folders/            (tree ops, bulk move, naming templates)
│   │       │   └── tags/
│   │       ├── repositories/
│   │       ├── queues/
│   │       │   ├── notifications/
│   │       │   ├── media-sync/
│   │       │   └── event-automation/   (auto status transitions, reminders)
│   │       └── server.js
│   └── web/
│       └── src/
│           ├── api/
│           ├── components/
│           │   ├── ui/                 (shadcn primitives)
│           │   ├── event-kanban/
│           │   ├── folder-tree/
│           │   └── gallery/
│           ├── layouts/
│           ├── pages/
│           │   ├── auth/
│           │   ├── super-admin/
│           │   ├── studio/
│           │   │   ├── dashboard/
│           │   │   ├── events/
│           │   │   ├── folders/
│           │   │   ├── cameras/
│           │   │   ├── customers/
│           │   │   ├── storage/
│           │   │   └── branding/
│           │   └── customer/
│           ├── stores/
│           ├── theme/                  (tokens, light/dark provider, brand injector)
│           └── App.jsx
├── infrastructure/
│   ├── postgres/ redis/ rabbitmq/ sftpgo/ immich/ piwigo/ nginx/
├── docker/
├── compose/
│   ├── app.yml
│   ├── data.yml
│   └── media.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 8. API surface (new endpoints, on top of v1's CRUD)

```
# Events
GET    /api/studio/events                 ?status=&type=&from=&to=
POST   /api/studio/events
GET    /api/studio/events/:id
PATCH  /api/studio/events/:id
POST   /api/studio/events/:id/status       { to_status, note }
GET    /api/studio/events/:id/history
GET    /api/studio/events/calendar         ?month=

# Tasks
GET    /api/studio/events/:id/tasks
POST   /api/studio/events/:id/tasks
PATCH  /api/studio/tasks/:id               { is_done, assignee_id, due_date }
GET    /api/studio/task-templates
POST   /api/studio/task-templates

# Folders
GET    /api/studio/folders/tree
POST   /api/studio/folders
PATCH  /api/studio/folders/:id             (rename, recolor, reorder)
POST   /api/studio/folders/:id/move        { target_parent_id }
POST   /api/studio/folders/bulk-move       { item_ids[], target_folder_id }  → queued job
DELETE /api/studio/folders/:id             (soft delete)

# Tags
GET    /api/studio/tags
POST   /api/studio/tags
POST   /api/studio/events/:id/tags
POST   /api/studio/assets/:id/tags
GET    /api/studio/assets/:id/suggested-tags

# Customer side (unchanged pattern from v1, now folder/branding aware)
GET    /api/customer/albums
GET    /api/customer/assets/:id/thumbnail
```

---

## 9. Backend-first phased build order

Per your instruction: **backend fully built and verified first, frontend fully modern after.** No frontend work starts until Phase 9 is API-complete and testable via Postman/curl.

### Backend phases

| Phase | Deliverable |
|---|---|
| 1 | Infrastructure: Postgres, Redis, RabbitMQ, SFTPGo, Immich, Nginx — verified running via Docker Compose |
| 2 | Express foundation: DB connection, migration tooling, auth (cookie sessions), RBAC, tenant middleware |
| 3 | Studio management: Super Admin creates studios + studio admins |
| 4 | Storage: configure → test connection → save (per studio), credential encryption |
| 5 | Cameras: create camera → SFTPGo user → upload path |
| 6 | Media pipeline: upload → detection → RabbitMQ → Immich sync |
| 7 | **Folders**: tree CRUD, move/bulk-move jobs, naming templates, tags + suggested tags from Immich |
| 8 | **Events**: status machine, history, tasks + templates, calendar query endpoints, automation jobs (auto-transition, reminders, notifications) |
| 9 | Branding: studio branding settings API; Customer accounts + login; album sharing tied into folders/events; full API regression pass (every endpoint tested end-to-end) |

### Frontend phases (start only after Phase 9 is done)

| Phase | Deliverable |
|---|---|
| 10 | Design system setup: Tailwind + shadcn/ui installed, token file, light/dark provider, brand-color injector, base layout shells for the 3 zones |
| 11 | Studio Portal core: dashboard, folder tree explorer, event list + calendar + kanban |
| 12 | Studio Portal detail: event detail page (tasks, status control, linked folder), storage/camera/branding settings screens |
| 13 | Customer Portal: login, "My Galleries" grid, lightbox, favorites/download, studio-branded theming in both light and dark |
| 14 | Super Admin zone, polish pass (empty states, loading states, error states), then production hardening: TLS, backups, monitoring, rate limits, audit log UI |

Piwigo comparison track (side-by-side with Immich) still runs independently and doesn't block any of the phases above.

---

## 10. Tech stack summary

| Concern | Choice |
|---|---|
| Frontend framework | React + Vite |
| Styling | Tailwind CSS + CSS variable tokens |
| Component library | shadcn/ui (Radix primitives) |
| Theme | Light/dark (system + user override) layered with per-studio brand color |
| Backend | Express (Node.js) |
| Database | PostgreSQL |
| Cache/sessions | Redis |
| Async jobs | RabbitMQ |
| File transfer | SFTPGo |
| Media engine | Immich (internal only), Piwigo as evaluation track |
| Reverse proxy/TLS | Nginx |

---

## 12. Feature deep dive — Per-Studio Billing Management

Each studio gets **two separate billing components**, priced and controlled independently:

1. **Application access** — a one-time payment for giving the studio access to the platform (their account, their zone, their branding).
2. **Storage usage** — recurring, metered, and only charged **if the studio uses storage the platform provides**. If a studio brings their own storage (their own server, their own S3 bucket, their own NAS/SFTP), that storage is **not billed by the platform at all** — the platform just connects to it.

This mirrors how `storage_providers` already works in the schema (§6/v1) — billing simply reads off of which provider type a studio is using per storage config, rather than needing a separate "billing mode" flag duplicated elsewhere.

### 12.1 The two billing tracks

**A. Application / platform-access billing**

- One-time charge per studio when they're onboarded (or per plan tier, if you later want tiers — e.g. "Basic," "Pro" — but v1 assumes one flat one-time fee unless you decide otherwise).
- Recorded once, doesn't recur, doesn't change based on usage.
- Lives on the studio's billing record as a single line item: `type = 'platform_access'`.

**B. Storage billing (metered, only for platform-provided storage)**

- Only applies when `storage_providers.provider_type = 'platform'` (i.e. the studio is using storage *you* host/give them) — **not** when the studio configured their own SFTP/S3/local server (`provider_type = 'studio_owned'`), which is excluded from billing entirely.
- Each studio using platform storage gets a **storage quota** (e.g. 100GB) that you set per studio — this is also the **usage restriction**: they physically cannot exceed it without you (or an automated tier upgrade) increasing it.
- Usage is tracked continuously (bytes stored, sampled daily) and billed against **tiers you configure** — e.g. 0–100GB = ₹X/month, 100–500GB = ₹Y/month, and so on. You define the tiers; the system just measures and applies them.
- When a studio approaches or hits their quota, they get a notification (via the same RabbitMQ notification pipeline as event reminders) and can request more — either self-serve (auto-upgrade to next tier, immediately reflected in next invoice) or admin-approved, your choice per studio.

### 12.2 Why storage type gates billing

```
storage_providers.provider_type
        │
        ├── 'platform'      → billed: quota assigned, usage metered, tier-based monthly cost
        │
        └── 'studio_owned'  → not billed: platform just proxies/connects,
                               studio pays their own server/S3/NAS bill directly
```

A studio can also **mix**: some cameras/events pointed at platform storage (billed), others pointed at their own SFTP/S3 (not billed) — billing is calculated per storage config, not per studio as a single blob, so this works without special-casing.

### 12.3 What "customizable per client" means concretely

- Every studio's storage quota, tier pricing, and even whether they're on metered billing at all is **set per studio**, not a single global plan. Super Admin can:
  - Assign a custom quota (e.g. Studio A gets 200GB, Studio B gets 1TB)
  - Assign custom tier pricing overrides (e.g. discount for a specific studio) without touching the global tier table
  - Manually adjust a studio's current bill (credit, override, comp a period) with an audit trail
- Nothing is hardcoded to "one plan for everyone" — the tier table is the *default*, and per-studio overrides sit on top of it.

### 12.4 Database model additions

```
billing_plans                     -- storage tier definitions (global defaults)
----------------
id
name                               -- e.g. "Starter", "Growth"
storage_gb_min
storage_gb_max                     -- nullable = unbounded top tier
price_per_month
currency

studio_billing_profile             -- per-studio billing configuration
----------------
id
studio_id
platform_access_fee                -- one-time amount charged
platform_access_paid_at
storage_quota_gb                   -- hard cap for platform-hosted storage
billing_plan_id                    -- nullable if custom-priced
custom_price_per_month             -- nullable override, takes precedence over billing_plan_id
billing_status                     -- active / past_due / suspended / comped
created_at

storage_usage_snapshots            -- daily metering, platform-hosted storage only
----------------
id
studio_id
storage_provider_id                -- only rows where provider_type = 'platform'
bytes_used
snapshot_date

invoices
----------------
id
studio_id
period_start
period_end
line_items                         -- jsonb: [{type: 'platform_access'|'storage', amount, description}]
total_amount
status                              -- draft / issued / paid / overdue
issued_at
paid_at

billing_adjustments                -- manual overrides/comps/credits, audit-tracked
----------------
id
studio_id
adjusted_by
amount                             -- positive or negative
reason
created_at
```

### 12.5 API surface — billing

```
# Super Admin
GET    /api/admin/billing-plans
POST   /api/admin/billing-plans
GET    /api/admin/studios/:id/billing-profile
PATCH  /api/admin/studios/:id/billing-profile      { storage_quota_gb, billing_plan_id, custom_price_per_month }
POST   /api/admin/studios/:id/billing-adjustments  { amount, reason }
GET    /api/admin/studios/:id/invoices
POST   /api/admin/studios/:id/invoices/generate

# Studio-facing (read-only for their own usage/billing)
GET    /api/studio/billing/usage                   -- current storage used vs quota
GET    /api/studio/billing/invoices
POST   /api/studio/billing/request-upgrade          -- request more quota (routes to admin or auto-approves per config)
```

### 12.6 Automation

- **Daily job (RabbitMQ)**: snapshot storage bytes used per studio per platform-hosted `storage_provider`, write to `storage_usage_snapshots`.
- **Monthly job**: generate `invoices` per studio — one line item for storage (based on tier or custom price), plus the one-time `platform_access_fee` line item only on the studio's very first invoice.
- **Quota-approaching job**: when a studio crosses 80%/100% of `storage_quota_gb`, fire a notification (reuses the notification pipeline from §3.6) to studio admins.
- **Studio-owned storage**: explicitly excluded from all of the above — no snapshot job runs against `provider_type = 'studio_owned'` rows at all, so there's no accidental billing.

### 12.7 Where this fits in the build order

Billing is backend work, so it slots into the **backend-first** phases from §9 — it depends on `storage_providers` (Phase 4) and needs to exist before the frontend billing screens are built:

| Phase | Deliverable |
|---|---|
| 8.5 (after Events, before Branding/Customer) | Billing: `billing_plans`, `studio_billing_profile`, usage metering job, invoice generation job, adjustment API, quota enforcement (block/warn on upload once `storage_quota_gb` is hit for platform-hosted storage) |

Frontend billing screens (Super Admin: manage plans/quotas/adjustments; Studio: view usage/invoices/request upgrade) slot into **Phase 12** alongside the other studio settings screens.


## 13. Roles & Permissions (RBAC)

Every request in Express passes through tenant + RBAC middleware before hitting a controller. Roles are scoped per zone — a user's role only means something inside the zone it belongs to.

| Role | Zone | Can do |
|---|---|---|
| **Platform Owner** | Super Admin | Everything: create/suspend studios, set billing plans and per-studio overrides, view all audit logs, impersonate a studio for support (logged) |
| **Platform Support** | Super Admin | Read-only on all studios, can view logs/usage, cannot change billing or delete data |
| **Studio Owner** | Studio | Full control of their studio: manage staff, cameras, storage, branding, billing view, all events/folders |
| **Studio Manager** | Studio | Manage events, tasks, folders, customers; cannot change storage/billing/branding config |
| **Photographer/Staff** | Studio | View/update assigned events and tasks; upload via camera/SFTPGo; cannot manage customers, storage, or billing |
| **Customer** | Customer | View only albums explicitly shared with them (via `album_customers`/`event_customers`); download per share permissions; no visibility into any other customer or studio's data |

### 13.1 Permission enforcement pattern

- Every studio-zone route requires: valid session → `studio_id` resolved from session/URL → row-level check that the requested resource (`event`, `folder`, `asset`, …) belongs to that `studio_id`. This tenant check happens in middleware, not ad hoc in each controller, so it can't be forgotten on a new route.
- Every customer-zone route additionally requires: resource is explicitly shared with the logged-in `customer_id` (via the join tables), not just "belongs to a studio the customer has some relationship with." A customer of Studio A must never be able to enumerate or access Studio B's data, or even other albums within Studio A they weren't given.
- Role checks are declarative on each route (e.g. `requireRole(['studio_owner', 'studio_manager'])`), not scattered `if` statements in business logic.

---

## 14. Security & Multi-Tenancy

### 14.1 Tenant isolation

- Single shared Postgres database, **logical isolation via `studio_id` on every tenant-owned table** plus the middleware check described in §13.1 — not separate databases per studio (keeps operations simple at this scale; can be revisited only if a studio's data volume/compliance needs demand physical isolation later).
- All queries go through the `repositories/` layer, which requires a `studio_id` parameter on every read/write for tenant-scoped tables — there is intentionally no "query without a tenant filter" code path available to controllers.

### 14.2 Credentials & secrets

- Studio storage credentials (SFTP/S3 keys, etc.) are encrypted at rest in Postgres using `CREDENTIAL_ENCRYPTION_KEY` (already reserved in `.env`), never returned in plaintext by any API response — API responses show only masked/last-4 values.
- `IMMICH_API_KEY` never leaves the backend; React and customers never see it, directly or indirectly (confirmed by the asset-proxy flow in §3 of the original plan).
- Session cookies: `httpOnly`, `secure` (HTTPS only), `sameSite=strict` where compatible with the customer-facing flow.

### 14.3 Data access boundaries

- Customer Portal queries are always scoped through the sharing tables (`album_customers`, `event_customers`) — never a direct "all assets for this studio" query, even filtered — to make over-exposure structurally hard to introduce by accident.
- Audit log (`audit_logs`) records: who did what, when, on which resource, from which zone — covers billing adjustments, storage config changes, role changes, and impersonation by Platform Support/Owner.

### 14.4 Network boundary (unchanged from v1, restated here for completeness)

- Only Nginx (443/80) and SFTPGo (2022) are internet-facing. Postgres, Redis, RabbitMQ, Express, Immich, SFTPGo admin, and Piwigo are internal-only, reachable by admins solely via VPN/Tailscale/SSH tunnel.

---

## 15. Non-Functional Requirements

### 15.1 Performance & scaling

- Thumbnailing, metadata extraction, Immich sync, notification sending, and storage usage metering all run as **async RabbitMQ jobs** — never inline in a request/response cycle, so large uploads or bulk folder moves don't block the API.
- Redis caches frequently-read, slow-to-compute data (e.g. folder tree structure, studio branding lookup) with short TTLs and explicit invalidation on write.
- Customer gallery endpoints are paginated by default; no "return every asset in one response" endpoint.

### 15.2 Backups & recovery

- Postgres: scheduled automated backups (daily full + WAL/point-in-time recovery), stored off the application server.
- Platform-hosted studio storage (where used): backed up per the storage provider's own durability guarantees (e.g. S3 versioning/replication); studio-owned storage is explicitly the studio's own responsibility, communicated clearly in onboarding.
- Soft-delete with a recovery window (folders, events, assets) before any hard delete job runs, so accidental deletion isn't immediately unrecoverable.

### 15.3 Monitoring & observability

- Structured logging from Express (request id, studio id, user id, route, latency) shipped to a log aggregator.
- Health-check endpoints for Express, Postgres, Redis, RabbitMQ, SFTPGo, and Immich connectivity, polled for uptime alerting.
- RabbitMQ queue depth and job failure rate monitored — a stuck media-sync or billing job should page someone, not fail silently.
- Storage usage snapshot job failures are treated as high-priority (billing correctness depends on them).

### 15.4 Testing strategy

- Unit tests on services (`events/`, `folders/`, `billing/`, etc.) covering the status-machine transition rules and quota/billing math specifically, since those have the most business-logic complexity.
- Integration tests against a real Postgres (test database) for tenant-isolation checks — explicitly test that Studio A can never read Studio B's data through any endpoint.
- End-to-end smoke tests for the critical paths: studio onboarding → camera upload → event auto-transition → customer views branded gallery → invoice generation.

### 15.5 Deployment & environments

- Three environments: local (Docker Compose), staging, production — same Compose structure (`app.yml`, `data.yml`, `media.yml`) across all three, differing only by `.env` values.
- CI pipeline: lint → unit tests → integration tests → build → (staging deploy automatic, production deploy manual approval).
- Database migrations run as a distinct, reviewed step before app deploy, never auto-applied silently on boot in production.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| **Studio** | A tenant of the platform — a photography business with its own staff, customers, branding, and storage config |
| **Event** | A shoot/booking (wedding, portrait session, etc.) with its own status workflow and tasks |
| **Folder** | A studio-defined organizational node (self-referencing tree); can contain events, albums, sub-folders, or assets directly |
| **Album** | A curated set of assets, typically shared with one or more customers |
| **Asset** | An individual photo/media file, indexed by Immich, physically stored wherever the studio's storage config points |
| **Platform-hosted storage** | Storage infrastructure the platform itself provides and bills for |
| **Studio-owned storage** | Storage the studio brings themselves (their own S3/SFTP/NAS); connected but never billed by the platform |
| **Tenant isolation** | The set of guarantees that one studio's data is never accessible to another studio or their customers |


## 17. Next step

This version adds the event workflow engine, the studio-defined folder tree, the theme system, per-studio billing management, the full RBAC model, security/multi-tenancy guarantees, and non-functional requirements (performance, backups, monitoring, testing, deployment) on top of the original v1 plan — all reflected in the schema, API surface, repo structure, and phased build order above.

Backend Phase 1 (infrastructure) is the natural starting point. Say the word and the next output will be the actual Docker Compose files, Postgres migrations (including `events`, `event_tasks`, `folders`, `tags`, `studio_billing_profile`, `invoices`, `billing_adjustments`), and the Express skeleton with auth + tenant + RBAC middleware.

