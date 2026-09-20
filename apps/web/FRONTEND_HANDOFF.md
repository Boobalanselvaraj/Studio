# Frontend handoff

The redesign is in apps/web. No backend source was changed.

## Run

From the repository root: `npm run dev:web`.
Open http://localhost:3000/studio/dashboard. Production check: `npm run build:web`.

## Implemented

- Shared light/dark design tokens, responsive studio and administrator navigation, keyboard-accessible dialogs, reduced-motion support, command search.
- Photo-led dashboard with derived event counts and persisted checklist state.
- Event creation, searchable board/list views, valid status transitions, drag/drop, event detail routes, month calendar.
- Collection creation, searchable customers with creation/details, camera draft forms and explicit connection placeholders.
- Branding editor with live preview and local persistence, storage and billing previews.
- Client collections, keyboard-accessible photo lightbox, local favorites and favorites filtering.
- Login calls the existing auth endpoint, reports errors, and offers a separate no-login demo entry point.
- Missing StorageSettingsPage and missing favicon references fixed; pages split into lazy-loaded chunks.

## Data boundary

Workspace screens deliberately run as a labeled frontend preview. Events/checklist/branding use the Zustand preview store in src/data/workspace.js; customer and collection drafts use localStorage. Camera drafts last for the current page session. These are not production records and there are no role guards on the preview routes. Do not use the preview routes to render private customer data until authentication and tenant authorization are connected.

Sign-in is wired to POST /api/auth/login through the existing Axios client. Set VITE_API_BASE_URL if the API is not at http://localhost:4000/api. Successful sign-in preserves token and first studio id, but workspace content remains sample data until the following integration work is completed.

## Backend integration map

- Events: GET/POST /studio/events; POST /studio/events/:id/status with `{ to_status }`. Frontend transitions match the existing controller. Replace preview actions with server mutations and loading/error states.
- Calendar: GET /studio/events/calendar. The preview derives the month from local events.
- Dashboard: GET /studio/dashboard; replace local counts and checklist items with real summaries/tasks.
- Customers: GET /studio/customers; account creation and invitations need an agreed endpoint and role checks.
- Folders/media: connect the existing folder routes and upload/download contracts. The preview does not upload files, provision storage, or issue downloads.
- Cameras: replace drafts with provisioning and sync responses; do not place service credentials in frontend code.
- Branding: GET/PUT /studio/branding; preview brand tokens currently affect the client layout.
- Billing/storage/admin: integrate their existing APIs before enabling management actions.
- Client galleries: fetch only the authenticated customer's albums, persist favorites server-side, and add authorized individual/ZIP downloads.
- Auth: hydrate session from /auth/me; enforce studio/admin/customer access, tenant selection, and logout behavior before production use.

## Images

Sample photos are remote Unsplash images; Google Fonts loads Plus Jakarta Sans. Both require network access. Photo components provide a local visual fallback if image loading fails. Replace samples with authorized studio media when integrating.
