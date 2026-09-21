# Studio platform implementation plan — v4

Prepared 2026-09-21 against `E:\Existing\Studio App`.

Status: implementation specification and source audit; features below are not yet implemented or certified. This document supersedes conflicting v3 decisions for allocations, storage, cameras, WiFi uploads, gallery sharing, billing and media integration. Existing event workflows, folders, branding and customer accounts remain in scope for regression testing.

## 1. Product contract

| Requirement | Required behavior | Completion evidence |
|---|---|---|
| R1. Platform control | Only Super Admin assigns each studio's storage quota, camera limit, feature entitlements, tier and prices. A tier is a template; a studio's effective configuration is authoritative. | Unauthorized writes rejected; cross-studio dashboard reflects actual allocations and usage. |
| R2. Storage ownership | Platform-provided connections are provisioned by the platform and their storage is billable. Studio-owned connections support multiple independent FTP, SFTP and S3 destinations and incur no platform storage charge. | Four simultaneous studio-owned connections work; platform bytes and studio-owned bytes are separated in every meter and invoice. |
| R3. Generic connection UI | Use “Storage connections”, “Add a storage connection”, “Add a server”, “FTP”, “SFTP” and “S3”. No internal vendor names in screens, client DTOs, field names or errors. | Automated string and response checks plus visual review. |
| R4. Camera management | Studio administrators register cameras and select their storage destination within the Super Admin allocation. | Concurrency tests prove the final slot cannot be claimed twice; all upload paths enforce camera authorization. |
| R5. WiFi uploads | A dedicated setup flow binds an authenticated upload profile to a camera, destination and optional event/album. | Real supported camera or companion upload reaches the selected destination, survives retries and cannot route across studios. |
| R6. Usage monitoring | Studios see platform used/reserved/remaining storage, usage history and per-camera breakdown; studio-owned usage is separately identified as not billed for storage. | Reconciliation and deletion tests match storage records; stale measurements never appear as zero. |
| R7. Two gallery access paths | Private customer accounts receive explicit grants; separate public bearer links permit viewing of selected published media until the studio's chosen expiry or revocation. | Every metadata, image, video and live-update request is authorized; expiry/revocation tests deny further access. |
| R8. Flexible billing | Per-studio, versioned components support one-time, recurring, allocated-capacity and metered charges. | Deterministic invoice examples, retries, mid-period changes and studio-owned exclusions pass. |
| R9. Internal media engine | Express and its backend workers alone integrate with Immich for indexing, thumbnails, EXIF and face detection. | No public engine port, client API key or direct client media URL; actual jobs complete in integration tests. |

“Zero errors” is not a verifiable promise. Readiness means all specified acceptance checks pass on the release candidate, real integrations are exercised, and no known access-control, data-loss, quota or billing defect remains open.

## 2. Verified starting point and release blockers

Paths below are repository-relative. These findings describe the inspected source, not a penetration test or a running-production assessment.

| Priority | Evidence | Required change |
|---|---|---|
| Blocker | `apps/api/src/routes/customerRoutes.js` registers image delivery and SSE before authentication. | Replace with authenticated private delivery and independently authorized public-share delivery. |
| Blocker | `customerController.js:getAlbumById` checks publication but not a customer grant; `getMyGalleries` falls back to published albums without requiring a grant. | No fallback access. Authorize album and asset membership for every request. |
| Blocker | `customerController.js:serveCustomerAsset` looks up a bare asset ID, resolves a stored local path and uses public one-day caching. | Tenant/gallery authorization, trusted storage adapter, path containment and private/no-store response policy. |
| Blocker | `services/storageWatcher.js` selects the first active studio, publishes an album and grants it to every customer; events are broadcast globally. | Explicit authenticated ingest mapping; no automatic publication/grants; scoped live updates. |
| Blocker | `schema.prisma` has neither camera allocation nor a camera-to-storage relation; `cameraController.js` creates without quota enforcement. | Allocation service, transactional reservation and same-studio destination reference. |
| Blocker | `storageController.js` accepts studio-created `platform` providers; its connection test performs no network I/O. | Admin-only platform provisioning; real protocol-specific probes. |
| High | `cameraController.js` marks camera creation successful before background provisioning is confirmed; disabling only changes the database. The status endpoint returns a full camera record. | Persist provisioning/revocation states, revoke gateway access and use safe explicit DTOs excluding password hashes. |
| High | `CamerasPage.jsx` exposes SFTPGo labels and request fields. | Generic upload credential names and API serialization. |
| High | `App.jsx` imports `pages/studio/storage/StorageSettingsPage`, which is absent in the inspected file inventory. | Implement the page and verify the production bundle. |
| High | `billingMeteringWorker.js` sums non-soft-deleted assets only; camera attribution and durable upload idempotency are missing. `getUsage` reads only today's snapshots and supplies a 50-unit fallback. | Physical inventory/ledger reconciliation, provenance, explicit allocation and freshness. |
| High | `billingController.js:requestUpgrade` returns success without persisting a request. | Durable allocation request, visible status and admin resolution; no entitlement change on submission. |
| High | `mediaSyncWorker.js:indexAsset` only saves a supplied engine asset ID; it does not perform media indexing. | Real versioned engine integration and job completion tracking. |
| High | `compose/media.yml` publishes engine and transfer-admin ports, uses floating engine tags, and lacks an explicit machine-learning service. | Pin a supported full stack, internal networking, compatible database/extensions and actual face-detection validation. |
| High | `app.js` accepts arbitrary credentialed CORS origins and falls back to process-local sessions. Admin/customer onboarding contains default passwords. | Origin allowlist, CSRF protection for cookie-authenticated mutations, production session-store failure handling and secure invitations. |

Baseline verification: `node --check` passed for all 51 JavaScript files under API source and Prisma seed directories. Git status was clean when inspected. This is syntax evidence only. API tests, full frontend build, live gateways, database migrations, real camera uploads and payment integration have not been validated in this planning task. Existing Jest suites mock database/integration behavior and cannot establish production correctness alone.

## 3. Business rules that prevent ambiguity

1. **Ownership is attached to each connection.** A studio may have platform storage, studio-owned storage or both. Adding studio-owned storage never removes camera limits or enables paid features. Changing the default connection affects only newly created profiles; existing cameras retain explicit routes.
2. **Quota is studio-wide across platform connections.** Store bytes as integers; use GiB consistently in new UI and pricing, where 1 GiB = 1,073,741,824 bytes. A studio-owned-only studio may have zero platform quota. New studios start unprovisioned until Super Admin explicitly assigns allocations; no hidden 50 GiB default.
3. **Every non-retired camera reserves a slot**, including provisioning, failed setup and disabled cameras. A retry reuses its slot. Retirement frees the slot only after transfer credentials and active sessions are revoked and in-flight uploads are resolved. Retired camera history stays attached to assets. Reactivation must reserve a slot again.
4. **Limit reductions:** reject a camera limit below reserved slots; require explicit retirement first. Reject an immediate storage limit below used plus reserved bytes; offer a scheduled reduction after cleanup. Never delete photos to make a new quota fit.
5. **Hard platform quota:** do not commit bytes above allocation. Reserve capacity before acceptance; uploaded bytes, in-flight reservations and retained originals count according to the accounting policy below. No automatic paid overage or automatic limit increase.
6. **Storage-owned accounting:** studio-owned originals, temporary processing copies and derivatives must not enter the platform-original-storage meter. Separate feature charges may apply only through explicit studio billing components.
7. **Access is explicit.** Uploads begin private and unpublished. Event association alone does not make a photo visible. Public event shares use a selected set of published albums; newly added albums are not automatically included. New published assets inside an already selected album are visible, which the share creation UI explains.
8. **Private grants:** direct album grants and explicit event grants may authorize viewing; an event grant covers its published albums by documented policy. Download/favorite permissions must be stored for either grant type, never inferred. No grants means an empty gallery list.
9. **Studio administrators:** owners and managers manage cameras, owned connections, WiFi and shares. Only owners see billing by default. Photographers use assigned upload profiles without seeing destination secrets; staff have only explicitly granted permissions. Super Admin actions remain audited.
10. **Billing state:** `active` permits entitled operations; `past_due` shows a warning while retaining access; `suspended` blocks new ingest and new shares but preserves existing authorized reads and data; `comped` retains metering and produces explicit waived charges. A separately deactivated studio denies all end-user access, including public links. No automatic deletion from a billing state.

These are implementation defaults selected to make the nine requirements consistent. Commercial amounts, real camera models and production service credentials are configuration inputs, not invented values.

## 4. Target architecture and responsibility boundaries

```text
Studio/admin/customer browser -> HTTPS -> Express authorization + business API
Public gallery visitor       -> HTTPS -> dedicated share authorization in Express
WiFi browser/companion       -> HTTPS -> upload sessions -> ingest service
WiFi-capable camera          -> supported transfer protocol -> gateway -> ingest service
                                              |
                         allocation + destination + upload-session checks
                                              |
                              selected connection adapter
                         /                                \
              platform-managed storage              studio-owned FTP/SFTP/S3
                         \                                /
                          committed original + durable outbox
                                              |
                       backend worker -> internal Immich -> derived media/index
                                              |
                         Express authorized media delivery -> viewer
```

PostgreSQL owns tenants, permissions, routing, resource reservations, usage events and financial records. RabbitMQ transports retryable jobs; Redis supports sessions/cache, not the authoritative quota ledger. Storage services hold original bytes. Immich is a derived-media/search engine, never the authority for customer permissions, studio identity, quotas or invoices.

Implement shared services behind thin controllers: allocation, connection registry/adapters, camera lifecycle, upload sessions, usage ledger/reconciliation, gallery authorization, share tokens, billing calculation and media-engine adapter. All background jobs call the same invariants as HTTP handlers.

## 5. Data model changes and integrity

Preserve existing IDs and extend the current Prisma/PostgreSQL model using reviewed migrations. Names below are logical proposed entities; final migration syntax must be validated on the pinned database.

| Entity | Essential fields and invariants |
|---|---|
| `studio_allocations` | One row/studio; platform quota bytes, camera limit, tier version, configuration version, effective timestamp. Nonnegative checks; admin audit. |
| `feature_catalog`, `tier_versions`, `tier_features`, `studio_feature_overrides` | Stable feature keys, enabled/disabled and optional limits; immutable tier versions. Overrides take precedence. Entitlements are distinct from prices. |
| Existing `storage_providers` | Add public protocol, ownership, enabled/lifecycle state, credential version, test result/time, stable root/prefix and metadata. Keep internal backend separate from public protocol. At most one default active connection per studio using a partial unique index. |
| Existing `storage_credentials` | Versioned encrypted secrets, key identifier and rotation metadata; never returned by ordinary reads. Remote connection credentials remain separate from camera upload credentials. |
| Existing `cameras` | Add destination ID, provisioning state, retired timestamp and version. Public DTO uses `upload_username`; legacy vendor column names can remain mapped internally during migration. |
| `upload_profiles`, `upload_credentials` | Same-studio camera, connection, optional event/album, protocol, expiry, credential version, revocation. Bind camera destination by default; changing a profile cannot silently override its camera. |
| `upload_sessions`, `quota_reservations` | Studio/camera/connection/profile versions, expected/received bytes, object identity, checksum, unique idempotency key, lease, state and timestamps. One terminal settlement per session. |
| Existing `assets` | Required connection for new uploads, camera/profile/upload provenance, immutable object key/version, physical-retention state and processing state. Unique completed-upload identity. |
| `storage_objects`, `usage_events` | Physical original inventory and append-only allocation/storage/feature deltas; unique source event key, exact bytes or decimal quantity, occurrence/recording times. |
| `usage_rollups` | Per-studio/connection/camera time buckets, reserved bytes, last observed timestamp and quality status. Rebuildable from ledger/inventory; snapshots never authorize writes. |
| `gallery_share_links`, `gallery_share_albums` | Studio, hashed token, expires/revoked timestamps, creator, publication scope, version; selected album set for event shares. No raw tokens stored. |
| Existing private grant tables | Enforce same-studio album/event/customer links, publication checks and explicit action permissions. Add event permissions to existing `event_customers` if used as viewing grants. |
| `billing_components` | Stable code, unit, charge kind, optional feature/meter key, supported calculation policy; data-driven catalog. |
| `studio_component_versions` | Studio component price, currency, included quantity, pricing basis, interval, proration, effective range; no overlapping effective versions. |
| `billing_runs`, `invoice_lines`, `payments`, `payment_events` | Idempotent run identity, immutable line calculation inputs, amounts, payment allocation, provider event uniqueness and reconciliation. Preserve existing invoice JSON as a compatibility snapshot. |
| `outbox_events`, `job_attempts`, `allocation_requests` | Durable side effects, retry/failed state, dedupe keys and request resolution. |

Use composite `(studio_id, id)` keys/references for tenant-owned associations, including camera-to-connection, profile-to-camera, album-to-asset and grants. Enforce event/gallery target consistency in both database constraints where expressible and service transactions. Add CHECK/partial/exclusion constraints through SQL migrations where Prisma cannot express them. Do not rely on client-supplied studio IDs or object UUID secrecy.

Represent byte values as BigInt and serialize decimal strings; use decimal arithmetic for money and quantities. Use UTC instants for events and half-open billing intervals `[start, end)`. Do not use floating-point `Number` for financial aggregation or large byte counters.

## 6. Storage connections and secrets

Studio settings list independent connections by display name, type, ownership, health, assigned cameras and last successful check. Support at least two SFTP and two S3 connections simultaneously, plus FTP; avoid an arbitrary one-connection limit.

- FTP: host, port, username, password, remote root, TLS mode and passive-mode settings as needed. Explain plain FTP's unencrypted transport in setup; use FTPS when supported. An FTP upload listener and a remote FTP destination are different capabilities.
- SFTP: host, port, username, password or supported private-key credential, root and verified host-key fingerprint.
- S3: endpoint/region, bucket, prefix, access key, secret key, optional session token and compatible addressing mode. Never imply an arbitrary bucket is owned by the platform.
- Platform connection: provision and price through Super Admin. Studio sees a generic managed destination and its scoped camera upload credentials, never the platform's master storage/admin credentials.

Use authenticated encryption with key IDs and rotation. Password replacement leaves the old value intact when omitted; a blank or redacted placeholder must not overwrite a real secret. Logs, traces, audit diffs and error responses must redact credentials. Show newly generated camera secrets once with rotation available later.

Connection tests actually resolve/connect/authenticate and test required permissions in a dedicated random probe location. Clean up probe objects; disclose cleanup failures. Return structured capabilities such as read/write/list/delete plus `tested_at`, not an unconditional success. Use timeouts, bounded retries, TLS/host-key validation and sanitized protocol-neutral errors.

Protect outbound connections against SSRF, loopback, cloud metadata and internal control-plane access, including DNS rebinding/redirects. Studio-local servers behind NAT require a documented VPN/connector or reachable endpoint with narrowly approved routes; a private host entered in the form is not automatically reachable from the platform.

Disabling a destination blocks new sessions. Credential rotation is versioned; coordinate reconnects and safe in-flight completion. Reject removal while cameras/profiles or retained assets reference a connection; archive it after references are resolved. Camera reassignment applies to new sessions only and does not move historical photos. Data migration is a separate copy-check-switch-delete workflow with progress and audit records.

**Protocol feasibility gate:** the checked-in gateway is `drakkan/sftpgo:v2.6-alpine`. Current documentation distinguishes editions and documents remote FTP support in Enterprise; that does not prove the checked-in image provides an FTP storage backend. Implement an independently tested FTP destination adapter if the chosen gateway cannot provide it. Do not release an FTP form backed by a nonfunctional adapter. [Official gateway documentation](https://docs.sftpgo.com/) and [remote FTP documentation](https://docs.sftpgo.com/Enterprise/ftpfs/).

## 7. Camera lifecycle and hard limits

`provisioning -> ready -> disabled -> retiring -> retired`, with an explicit `provision_failed` state and retry action. Online/offline telemetry is separate from enabled/disabled/provisioning state; report last successful upload and unknown connectivity truthfully.

Creation transaction: lock the studio allocation row; verify current authorization, billing state and feature configuration; count/reserve non-retired slots; validate same-studio active destination; create camera and durable provisioning job; commit. Return 202/provisioning until gateway provisioning succeeds. External network calls run outside the database transaction. A unique operation key makes retries reuse the existing camera and slot.

Do not activate a camera on a gateway conflict unless the existing gateway identity is verified as belonging to that exact studio/camera. Gateway usernames are generated and tenant-scoped. Use least-privilege upload paths rather than wildcard permissions.

Disabling/retiring revokes gateway credentials and sessions, WiFi tokens and outstanding authorizations. During a failed revocation, show a pending state and retain the slot; do not claim the device is fully disconnected. Enforce this across FTP/SFTP/HTTPS and any direct-object upload support.

Limits govern registered logical camera identities. Physical cameras can share a copied credential unless supported hardware supplies reliable device identity. Prevent extra registered cameras and restrict credentials/sessions, but do not promise perfect physical-device counting for generic FTP hardware.

## 8. Upload correctness and WiFi setup

WiFi is the network transport, not an upload protocol. Support (a) camera FTP/FTPS/SFTP transfer over WiFi when the specific model supports it, and (b) HTTPS uploads from a phone/browser or companion uploader. Cameras without a compatible network-upload capability need that companion. No universal camera compatibility claim.

Setup flow: choose camera/profile -> choose available transfer method -> confirm destination and optional event/album -> generate scoped credentials or pairing token -> show connection instructions -> perform a test upload -> confirm arrival/processing. Photographers receive only their assigned profile. WiFi entitlement is checked at setup and on every upload, independent of storage ownership.

All uploads use one persisted lifecycle:

1. Authenticate transfer identity; derive studio/camera server-side. Pin destination and profile version. Verify same-studio event/album and current entitlements.
2. Reserve platform capacity atomically, or skip platform-original quota for a studio-owned destination. Use bounded streaming sessions and enforce actual byte counts rather than trusting file-size headers.
3. Transfer to a private temporary object, validate final size/checksum/type and commit via an idempotent object identity. A timer noticing a file is insufficient proof the upload completed.
4. Atomically record asset provenance, settle the reservation, append the usage event and enqueue an outbox event. If the storage write succeeds and database commit fails, reconciliation identifies the orphan; retries must not charge or create the asset twice.
5. Publish outbox events with broker confirmation. Consumers commit their work before ack, retry transient failures with backoff and send permanent failures to a dead-letter queue with operator replay.
6. Queue media processing; keep upload success distinct from thumbnail/analysis readiness. Never publish or share an album automatically.

For FTP/SFTP streams whose final length is unknown, use enforced byte reservations in chunks, or reserve a configured maximum file size and release the difference. Gateway hooks alone are not sufficient unless the exact build enforces the reservation before additional writes. If unsupported, use bounded private staging and authorize commit into managed storage; cap staging independently and do not present the upload as committed beforehand. Concurrent transfers across nodes must never bypass the central quota reservation.

Reservations have leases and heartbeats. Recovery expires them only after the writer is stopped or fenced off; otherwise an old writer could continue after its capacity is reallocated. Resume uses the same session/object identity, validates acknowledged offsets and charges only once. Object naming prevents one camera from overwriting another camera's uploads. Deletion and overwrite accounting track physical retained versions, not just filenames.

Direct uploads to a studio's own server outside platform credentials cannot be stopped by this application and cannot be assumed observed. The app's limits govern its managed camera/profile connections. Report studio-owned observations as tracked usage, not the provider's total account usage, unless an authoritative inventory integration exists.

## 9. Metering and dashboards

Billable storage is retained platform-managed original bytes, including trash until physical purge succeeds. Logical soft deletion alone does not release quota. Derived thumbnails, processing caches and backups are excluded from this original-storage meter and budgeted internally; any processing fee is an explicit separate component.

Use the authoritative committed-byte ledger plus live reservations for quota. Reconcile it against storage inventory periodically, including partially written objects, failed deletes, retained versions and out-of-band writes. Block or constrain ingest on unresolved quota uncertainty; do not silently count unknown usage as zero. Backups and operational disk headroom require a separate capacity alert.

Admin overview: studio, tier, used/quota/reserved platform bytes, percent/remaining, registered/allowed cameras, connection health, billing status, unpaid amount, estimated current charges and measurement timestamp. Paginate/filter by studio, billing state and approaching/exceeded limit. Aggregate in the backend without fetching every customer/asset.

Studio view: current platform storage, quota remaining, history with gaps shown, per-camera/connection breakdown and billing period estimate. Show studio-owned tracked usage separately with “Storage paid directly to your provider.” Label whether data is current, delayed or unavailable. Suggested alerts at 80%, 90% and 100% of platform quota; deduplicate notifications.

Every new asset has connection provenance and camera attribution where available. Legacy unknown attribution appears in an explicit “Unassigned legacy uploads” bucket; never guess the first camera or provider to make charts complete.

## 10. Gallery authorization and public links

Private routes authenticate the customer, resolve the explicit same-studio album/event grant and verify publication plus requested action. Studio preview uses a separate studio-role route. Asset delivery verifies the asset belongs to an authorized album and is not deleted. Filtering only the list page is insufficient.

Public shares use at least 32 cryptographically random token bytes encoded for URLs. Store only a token hash, studio ID, selected albums, expiry, revocation and scope version. A public link has view scope only: no download-original endpoint, favorites, upload, editing, customer account creation or studio enumeration. Display images can still be saved or screenshotted by a viewer; “view only” is an authorization limit, not DRM.

Studio selects a positive finite expiry duration or exact date/time, displayed with timezone and stored as UTC. Provide convenient presets plus custom duration; do not impose an undisclosed fixed short TTL. No non-expiring option for this short-lived-link feature. Validate dates within supported storage/runtime range. Expiry is enforced when `now >= expires_at`, independent of cleanup jobs.

Use a share landing URL with the bearer token in the fragment, exchange it via POST for a narrowly scoped HttpOnly/Secure share session, and remove the fragment from browser history. Disable third-party tracking on this flow. Redact token exchange bodies in logs. Share sessions expire no later than the link and are checked against revocation/scope version on each request. A logged-in customer arriving through a public link must not receive broader share privileges.

Use dedicated `/api/public/...` routes and authorize every thumbnail, video/range response and album query through the share session. Keep data delivery behind Express so revocation applies to subsequent requests. Initial release uses private/no-store delivery and no public signed original URLs. Already delivered bytes cannot be recalled. Long streams and SSE must stop at expiry/revocation, not only check at initial connection.

SSE subscriptions are scoped to authorized studio/gallery/share, filtered server-side and closed on grant removal. Do not broadcast raw global ingest events. Unpublish/delete removes media from both paths immediately for new requests. Invalid, unknown, revoked and expired share responses must not reveal private resource metadata. Rate-limit token exchanges and media enumeration.

## 11. Flexible billing components

Separate three concepts: feature entitlement (can use), resource allocation (how much), and billing configuration (what it costs). Enabling an entitlement does not silently create a charge. A billed capacity increase does not change the camera limit until Super Admin explicitly applies the corresponding allocation update.

| Component example | Calculation basis | Duplicate-prevention rule |
|---|---|---|
| App setup fee | One-time amount per studio contract | Unique studio/component/contract charge identity; migration respects already-paid setup fees. |
| Platform storage | Time-weighted GiB-month, or explicitly contracted allocated GiB-month | Meter includes only platform-owned originals. Pricing basis is recorded on the contract. |
| Extra cameras | Reserved camera-month above included count, or contracted allocated slots | Count provisioning/disabled slots consistently; do not also charge the same allowance under a hidden tier fee. |
| WiFi upload | Fixed monthly entitlement fee OR successful upload count/bytes, as configured | Retry/failure events do not add usage. Distinct charges require explicit named components. |
| Additional public shares | Successful link creations above included count per period | Retry same operation = one share; views and expiry edits are not creations. Rotation replacing a compromised token is not a new billed share by default. |
| Priority support | Recurring contracted service amount | Independent of storage ownership. |

Catalog entries use stable codes and typed configuration, not executable price formulas supplied by an administrator. New features using existing charge kinds require data/configuration and meter integration, not one new database column per feature. A genuinely new pricing algorithm may still require validated application code.

For metered storage over billing interval duration `T` seconds:

`GiB-month quantity = sum(platform_bytes_i * seconds_i) / (1,073,741,824 * T)`.

Split intervals at usage changes and contract effective dates. Integrate exactly with decimal/integer arithmetic, apply included quantity by its configured policy, calculate line amount and round only at the currency's minor-unit boundary. Count meters use successful unique business events; allocation meters use effective allocation intervals. A missing interval is unresolved usage, not zero; hold invoice finalization until reconciled.

Example test fixtures (illustrative amounts, not approved prices):

- 100 GiB for 15 days then 200 GiB for 15 days in a 30-day period = 150 GiB-month. At INR 2 per GiB-month, storage is INR 300. Another 500 GiB in studio-owned S3 adds INR 0 storage charge.
- INR 1,000 one-time app fee + INR 300 storage + INR 200 WiFi recurring = INR 1,500 before applicable configured adjustments/tax. The next period must not repeat the setup fee.
- 12 unique created shares, 10 included, INR 5 each additional share = INR 10; two request retries leave that unchanged.
- A change from INR 2 to INR 3 effective halfway through a period with constant 100 GiB produces INR 100 + INR 150 = INR 250, without repricing the first half.

Contract changes require an effective timestamp and admin audit. Default to next-period changes; allow explicit mid-period changes with displayed proration preview. Prevent overlapping active versions. Freeze issued invoice lines with quantity, rate, currency, discounts/waivers, source window and calculation version. Corrections use linked credits/adjustments, not silent edits to issued invoices. Apply each existing billing adjustment once.

Invoice generation acquires a per-studio/period run identity and is retry-safe. Payment events require verified provider signatures and unique event IDs; reconcile out-of-order events and partial payments against outstanding invoice balances. Never accept client assertions of payment success. Until a payment provider is selected, implement audited manual payment recording as explicitly manual; do not claim automatic collection. Tax rules require configured jurisdiction-specific policy, not invented rates.

## 12. Immich: developer-only integration contract

Immich performs internal indexing, thumbnail generation, metadata/EXIF extraction and face detection. Express and backend workers make server-to-server calls. Studios and customers interact only with this platform's API and branded UI. Never return an engine URL, key, engine user identity, raw engine error or engine share link to clients.

Current official external-library support expects readable filesystem paths, so an S3 bucket or remote FTP credential is not itself an Immich import path. This is a material integration requirement. [Immich external-library documentation](https://docs.immich.app/features/libraries/).

Use an internal per-studio media identity/library mapping and an adapter that records platform asset IDs to engine asset IDs. The proposed storage bridge is a stable, read-only filesystem view of the authoritative originals: local mounts for managed local storage and a tested read-through filesystem adapter for remote stores. Keep paths stable across rescans; logical album/folder reorganization must not rename source object keys. Bound local cache size, exclude it from studio storage billing, and expose provider outages as processing delays. This bridge is a phase-1 feasibility gate, not existing functionality.

Do not substitute an undisclosed permanent mirror of studio-owned originals. If the bridge cannot reliably support the pinned engine/version and required formats, document the specific blocker and choose an explicit alternative storage/processing design before implementation proceeds. Temporary files must not disappear while an external library still requires their paths. Copies, deletion, retention and rescans must be tested together.

Media jobs track queued/processing/ready/failed states, retry idempotently and correlate by platform asset identity. Photos can be stored successfully while analysis is pending. Engine failure must not lose originals, duplicate charges or publish incomplete/unapproved galleries. Remove private face data from all public DTOs; scope face queries to the studio's internal media identity.

Pin an exact tested Immich release and compatible database, extensions, Redis and machine-learning services. Remove production host port publication for engine/API administration; use private service networking. Confirm thumbnail, EXIF, face-detection and video jobs with real files rather than merely checking a container health endpoint. Keep platform ACL metadata authoritative and back up its engine mapping for rebuild/reindex recovery.

## 13. API and frontend delivery map

Routes below are proposed contracts, not claims about existing endpoints. Document final schemas in OpenAPI with validation, safe DTOs, permission requirements and idempotency semantics before frontend integration.

| API family | Operations |
|---|---|
| `/api/admin/studios` | Paginated fleet usage/billing summary; create studio with explicit allocations. |
| `/api/admin/studios/:id/allocations` | Read/update quotas, camera slots and tier/feature overrides using expected configuration version. |
| `/api/admin/studios/:id/storage-connections` | Provision and maintain platform-owned destinations. |
| `/api/admin/studios/:id/billing-components` | Read/version component contracts; preview charges/effective changes. |
| `/api/admin/studios/:id/invoices` | Generate/finalize/reconcile invoices and audited manual payments. |
| `/api/studio/allocations`, `/allocation-requests` | Read effective limits; persist and track requests, never self-apply. |
| `/api/studio/storage-connections` | List/create/update/test/rotate/archive owned connections; managed connections are read-only. |
| `/api/studio/cameras` | Create/list/detail; destination changes, provision retry, disable and retire. |
| `/api/studio/upload-profiles` | WiFi setup, pairing, test state, expiry and revoke. |
| `/api/uploads/sessions` | Scoped machine/photographer session creation, stream/chunk upload, finalize and abort. |
| `/api/studio/storage-usage` | Current/historical usage and breakdown, freshness and ownership filters. |
| `/api/studio/albums/:id/shares`, `/events/:id/shares` | Create/list/update expiry/revoke public shares and maintain selected album scope. |
| `/api/customer/...` | Private grant-authorized galleries/media/actions. |
| `/api/public/share-sessions`, `/api/public/...` | Token exchange and independent view-only gallery/media/SSE access. |
| `/api/internal/ingest-events` | Authenticated, replay-protected gateway events; never trust supplied tenant IDs alone. |

Standard errors: `CAMERA_LIMIT_REACHED`, `STORAGE_QUOTA_EXCEEDED`, `FEATURE_DISABLED`, `DESTINATION_UNAVAILABLE`, `CONNECTION_TEST_FAILED`, `CONFIGURATION_CHANGED`, `RESOURCE_NOT_FOUND`. Responses contain safe explanations, retry guidance and correlation ID, not stack traces/vendor response bodies. Use strict types for booleans/numbers, reject unknown privileged fields and require same-studio checks on every foreign ID. Return 202 only for persisted asynchronous work.

Frontend work: extend admin studio table and studio detail allocation/billing panels; implement missing storage page; add camera destination/limit/provisioning states; add dedicated WiFi wizard; add storage history and feature billing breakdown; add gallery-sharing dialog with custom expiry and revoke; add a public viewer outside the private login layout. Include loading/empty/stale/error/retry states, keyboard access and mobile layouts. Do not use demo data or success toasts as evidence of a completed server operation.

## 14. Migration and delivery sequence

| Phase | Work and main files | Exit gate |
|---|---|---|
| 0. Close existing exposure | Customer routes/controller, storage watcher, media DTOs/cache, CORS/session/onboarding safeguards. | Anonymous and cross-tenant access denied; uploads no longer auto-share; private access regressions pass. |
| 1. Prove integrations | Pin gateway/engine stack; exercise FTP/SFTP/S3 destinations, quota enforcement and media bridge; choose real camera test matrix. | Each advertised protocol transfers a real file; engine processes remote/local originals; documented supported camera paths. |
| 2. Migrate core model | Prisma migrations, allocation/entitlement/provenance and outbox services; migration dry run on production-like copy. | Tenant constraints and quotas validate; legacy ambiguities quarantined; restore tested. |
| 3. Build ingest | Connection lifecycle, camera reservations/provisioning, WiFi sessions, usage ledger and retry/reconciliation workers. | Concurrent limit, replay, disconnect and crash tests pass using real services. |
| 4. Complete media/access | Actual Immich adapter, processing state, private grants, public shares and scoped streaming. | Publication, expiry, revocation, tenant isolation and media job tests pass. |
| 5. Complete billing/admin APIs | Versioned components, meters, invoices, payment recording/integration and fleet dashboard. | Exact fixture totals, uniqueness, backfill and reconciliation pass. |
| 6. Integrate frontend | `App.jsx`, API services, admin pages, cameras/storage/WiFi/billing/public gallery pages. | Production build and browser E2E pass with real backend responses; generic wording verified. |
| 7. Release rehearsal | Full workflow, migration/restore, monitoring and failure exercises. | All acceptance gates below passed on the same pinned release candidate. |

Use expand/backfill/validate/contract migrations, not production `prisma db push`. Back up DB, originals, billing records and encryption-key references before migration. Preserve a recoverable snapshot of the current configuration and invoices.

Backfill existing quotas using the current code's 1024-based interpretation and label them GiB. Existing studios require explicit Super Admin camera limits; do not silently invent commercial allocations. Migrate prices to effective component versions while preserving prior invoice amounts and setup-fee paid state. Unknown original ownership, storage connection or camera attribution becomes an admin reconciliation issue, not guessed billable usage.

Temporarily deny new ingest for unresolved allocations/ownership. Do not remove existing read access merely because migration attribution is incomplete. Existing camera usernames can retain internal mappings while public API names change; plan coordinated credential rotation for devices needing reprovisioning. Stop old watcher/worker paths before enabling new ingestion so both cannot create the same asset.

Deploy backward-compatible readers/writers first; enable new routes behind feature gates after backfill and shadow meter comparison. At cutover, establish one billing source of truth and one ingest writer. Reconcile usage against originals before invoice finalization. Rollback disables new writes/features and restores compatible application versions; after irreversible writes, prefer a reviewed forward correction or a consistent DB-plus-storage restore, not an untested schema downgrade.

## 15. Required acceptance tests

| ID | Test and expected result |
|---|---|
| A01 | Owner/manager/photographer/customer try changing quota/tier/prices: denied. Super Admin change succeeds and records actor/before/after/effective time. |
| A02 | Studio A submits Studio B's connection/camera/album/customer IDs through HTTP, jobs and media requests: denied; no foreign data or existence details leak. |
| A03 | Ten concurrent camera creates with one slot remaining: exactly one reservation; retry creates no extra camera. Disabled/failed cameras still count. |
| A04 | Gateway unavailable during create: camera stays pending/failed, never ready; retry uses same identity. Retirement outage retains slot and pending revocation state. |
| A05 | Four connections (two SFTP/two S3) plus FTP are saved, tested, rotated and assigned independently; invalid credentials and permissions fail real probes. |
| A06 | Studio attempts creating/editing a platform-owned provider through owned-connection endpoints: denied. Platform master secrets never appear in responses/logs. |
| A07 | Concurrent uploads at quota boundary across nodes/protocols: committed bytes never exceed allocation; byte misreporting and unknown-length streams cannot bypass. |
| A08 | Disconnect, retry, duplicate gateway event and worker crash after storage commit: one original identity, one asset and one usage event; reservations recover safely. |
| A09 | Camera route changes mid-upload: old session stays pinned, next session uses new destination; historical assets stay readable on their original connection. |
| A10 | Supported WiFi camera and companion flows upload to selected camera/event/storage; disabled feature, expired pairing and retired camera reject new uploads. |
| A11 | Studio-owned uploads create zero platform storage charge. Explicit WiFi/camera/share charges still apply according to the studio contract. |
| A12 | Soft delete retains quota until physical purge; failed purge retains usage; retained versions reconcile; restore updates state without double charging. |
| A13 | Customer with no grants sees no galleries; guessed published album ID, original URL, thumbnail and SSE do not bypass grants. |
| A14 | Valid public link views only selected published albums. Expiry at the exact boundary, revocation and unpublishing deny subsequent metadata/media requests and terminate live streams. |
| A15 | Public viewer cannot download originals, favorite, mutate or view face data. Share session never gains private customer privileges. |
| A16 | Engine outage keeps originals durable and processing pending; retry yields actual thumbnails/EXIF/face results with no cross-studio mapping. |
| A17 | API/frontend failure paths and rendered forms contain no internal vendor labels/fields/secrets. Production network cannot reach engine/admin ports. |
| A18 | Billing examples in section 11 match exactly; duplicate runs, duplicate/out-of-order payment events and already-paid setup fees do not duplicate charges. |
| A19 | Mid-period price/allocation/entitlement changes, month boundaries and missing meter intervals follow effective contracts; gaps block finalization. |
| A20 | Admin and studio usage reconcile; missing/stale provider observations appear as unknown/stale, not zero. Per-camera totals include an explicit legacy bucket. |
| A21 | Missing frontend storage route resolved; all roles complete relevant flows in a production build with loading, error, empty, retry and mobile states. |
| A22 | Migration dry run and restore preserve media, studio grants, key access and issued invoices; no unknown provider is silently billed. |
| A23 | SSRF/metadata endpoints, path traversal, malformed IDs, CSRF and unauthorized origins fail; logs never contain tokens or storage passwords. |
| A24 | Scheduled jobs restart without duplicate invoices/assets; dead-letter replay and broker/database failures preserve idempotency and tenant isolation. |

Run unit tests for calculation/state transitions, PostgreSQL-backed integration tests for locks/constraints, real protocol/engine tests for adapters, and browser E2E for each role. Existing mocked tests must be updated when they encode insecure fallback behavior. Add production build, Prisma validation/migration validation, supported-runtime checks and dependency validation to CI. Repair the root API build script pointing to a nonexistent workspace build command and the lint scripts lacking a configured dependency before treating CI as complete.

Release rehearsal must include a complete studio lifecycle: create studio -> allocate -> provision platform storage -> add multiple owned connections -> register cameras -> test WiFi -> ingest/index -> publish -> grant private access -> issue/revoke public link -> reconcile usage -> produce/pay invoice. Repeat core isolation checks with two studios and distinct customers. Record release commit, service versions, test result/log references and any known limitations; no blanket “100% working” claim without that evidence.

## 16. Operational acceptance and configuration still needed

Monitor ingest failures, quota reservation age, orphan objects, reconciliation drift, queue depth/dead letters, connection health, engine backlog, storage headroom, failed payment events and invoice reconciliation. Alerts need an owner and recovery instructions. Keep logs correlation-based and redacted. Define supported file types/maximum size, expected concurrent cameras/uploads, retention and recovery objectives before load/recovery signoff.

Inputs needed during implementation: actual supported camera models/firmware; reachable FTP/SFTP/S3 test endpoints; selected gateway/engine release and deployment sizing; per-studio prices/limits/features; payment provider or manual billing mode; production domains and approved origins. These inputs do not prevent writing the plan, but they are required to validate their respective integrations. Do not substitute fabricated credentials, arbitrary prices or mock integration success.

Recommended next implementation task is phase 0, followed by the protocol/media feasibility gate. Later work must preserve all nine product requirements and satisfy the full test matrix before release.
