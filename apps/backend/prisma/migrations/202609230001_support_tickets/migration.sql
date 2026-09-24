CREATE TABLE IF NOT EXISTS "support_tickets" (
 "id" UUID PRIMARY KEY, "studio_id" UUID NOT NULL REFERENCES "studios"("id"),
 "created_by" UUID NOT NULL REFERENCES "users"("id"), "subject" TEXT NOT NULL,
 "description" TEXT NOT NULL, "category" TEXT NOT NULL DEFAULT 'general',
 "priority" TEXT NOT NULL DEFAULT 'normal', "status" TEXT NOT NULL DEFAULT 'open',
 "resolution" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "support_tickets_studio_id_status_idx" ON "support_tickets"("studio_id","status");

ALTER TABLE "album_customers" ADD COLUMN IF NOT EXISTS "can_share" BOOLEAN NOT NULL DEFAULT false;
