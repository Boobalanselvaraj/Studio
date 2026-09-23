-- AlterEnum
ALTER TYPE "storage_backend" ADD VALUE 'ftp';

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "camera_id" UUID,
ADD COLUMN     "object_key" TEXT,
ADD COLUMN     "processing_error" TEXT,
ADD COLUMN     "processing_state" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "upload_session_id" UUID;

-- AlterTable
ALTER TABLE "cameras" ADD COLUMN     "lifecycle" TEXT NOT NULL DEFAULT 'needs_setup',
ADD COLUMN     "operation_key" TEXT,
ADD COLUMN     "retired_at" TIMESTAMPTZ,
ADD COLUMN     "storage_provider_id" UUID;

-- AlterTable
ALTER TABLE "storage_providers" ADD COLUMN     "health" TEXT NOT NULL DEFAULT 'untested',
ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tested_at" TIMESTAMPTZ,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "studio_billing_profile" ADD COLUMN     "camera_limit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "config_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "storage_quota_gb" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "upload_profiles" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "camera_id" UUID NOT NULL,
    "album_id" UUID,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "camera_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "storage_provider_id" UUID NOT NULL,
    "album_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "expected_bytes" BIGINT NOT NULL,
    "object_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "error" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMPTZ,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "album_ids" JSONB NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "operation_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_components" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "meter" TEXT,
    "unit_price" DECIMAL(18,6) NOT NULL,
    "included_quantity" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "effective_from" TIMESTAMPTZ NOT NULL,
    "effective_to" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "meter" TEXT NOT NULL,
    "quantity" DECIMAL(30,8) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_runs" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "invoice_id" UUID NOT NULL,

    CONSTRAINT "billing_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_requests" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "requested_quota_gb" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_jobs" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "locked_at" TIMESTAMPTZ,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_profiles_token_hash_key" ON "upload_profiles"("token_hash");

-- CreateIndex
CREATE INDEX "upload_profiles_studio_id_camera_id_idx" ON "upload_profiles"("studio_id", "camera_id");

-- CreateIndex
CREATE INDEX "upload_sessions_studio_id_status_idx" ON "upload_sessions"("studio_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_profile_id_idempotency_key_key" ON "upload_sessions"("profile_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_hash_key" ON "share_links"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_studio_id_operation_key_key" ON "share_links"("studio_id", "operation_key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_components_studio_id_code_effective_from_key" ON "billing_components"("studio_id", "code", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_source_key_key" ON "billing_events"("source_key");

-- CreateIndex
CREATE INDEX "billing_events_studio_id_meter_occurred_at_idx" ON "billing_events"("studio_id", "meter", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_runs_invoice_id_key" ON "billing_runs"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_runs_studio_id_period_start_period_end_key" ON "billing_runs"("studio_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "integration_jobs_status_next_attempt_at_idx" ON "integration_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_jobs_kind_resource_id_key" ON "integration_jobs"("kind", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_upload_session_id_key" ON "assets"("upload_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_operation_key_key" ON "cameras"("operation_key");

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_storage_provider_id_fkey" FOREIGN KEY ("storage_provider_id") REFERENCES "storage_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
