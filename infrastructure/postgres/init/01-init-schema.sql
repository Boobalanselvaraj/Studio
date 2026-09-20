-- ==============================================================================
-- Photo Studio SaaS Platform — Initial Schema (v3)
-- Multi-Tenancy via studio_id + Workflow Engine + Custom Folders + Billing
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Core Multi-Tenant Structure
-- ==============================================================================

CREATE TABLE studios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    custom_domain VARCHAR(255) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE studio_role AS ENUM (
    'studio_owner',
    'studio_manager',
    'photographer',
    'staff'
);

CREATE TABLE studio_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role studio_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(studio_id, user_id)
);

CREATE TABLE studio_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID UNIQUE NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    brand_name VARCHAR(255),
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#3B82F6',
    secondary_color VARCHAR(20) DEFAULT '#1E293B',
    accent_color VARCHAR(20) DEFAULT '#10B981',
    custom_css TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(studio_id, user_id)
);

-- ==============================================================================
-- 2. Storage & File Gateway (SFTPGo / Immich)
-- ==============================================================================

CREATE TYPE storage_provider_type AS ENUM ('platform', 'studio_owned');
CREATE TYPE storage_backend AS ENUM ('local', 'sftp', 's3', 'smb');

CREATE TABLE storage_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider_type storage_provider_type NOT NULL DEFAULT 'platform',
    backend storage_backend NOT NULL DEFAULT 'local',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE storage_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_provider_id UUID UNIQUE NOT NULL REFERENCES storage_providers(id) ON DELETE CASCADE,
    encrypted_config TEXT NOT NULL, -- Encrypted JSON (keys, secrets, endpoints)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255),
    sftpgo_username VARCHAR(100) UNIQUE NOT NULL,
    sftpgo_password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. Event & Shoot Workflow Engine
-- ==============================================================================

CREATE TYPE event_status AS ENUM (
    'lead',
    'booked',
    'scheduled',
    'shooting',
    'editing',
    'review',
    'delivered',
    'archived',
    'cancelled'
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- wedding, portrait, corporate, etc.
    status event_status NOT NULL DEFAULT 'lead',
    source VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual' | 'booking_form'
    event_date_start TIMESTAMPTZ,
    event_date_end TIMESTAMPTZ,
    location VARCHAR(255),
    delivery_deadline TIMESTAMPTZ,
    notes TEXT, -- Staff internal notes
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    from_status event_status,
    to_status event_status NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE(event_id, customer_id)
);

CREATE TABLE event_task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. Studio-Custom Folders & Tag Tree
-- ==============================================================================

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    icon VARCHAR(50),
    color VARCHAR(20),
    naming_template VARCHAR(255), -- e.g. "{event_date} - {event_title}"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    is_done BOOLEAN NOT NULL DEFAULT false,
    linked_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_asset_id UUID,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    storage_provider_id UUID REFERENCES storage_providers(id) ON DELETE SET NULL,
    immich_asset_id VARCHAR(255),
    filename VARCHAR(255) NOT NULL,
    original_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    width INT,
    height INT,
    exif_data JSONB DEFAULT '{}',
    is_soft_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE folder_item_type AS ENUM ('event', 'album', 'asset');

CREATE TABLE folder_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    item_type folder_item_type NOT NULL,
    item_id UUID NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(folder_id, item_type, item_id)
);

CREATE TABLE album_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(album_id, asset_id)
);

CREATE TABLE album_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    can_download BOOLEAN NOT NULL DEFAULT true,
    can_favorite BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(album_id, customer_id)
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(studio_id, label)
);

CREATE TYPE tag_source AS ENUM ('manual', 'suggested');

CREATE TABLE event_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    source tag_source NOT NULL DEFAULT 'manual',
    UNIQUE(tag_id, event_id)
);

CREATE TABLE asset_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    source tag_source NOT NULL DEFAULT 'manual',
    UNIQUE(tag_id, asset_id)
);

-- ==============================================================================
-- 5. Billing & Storage Metering
-- ==============================================================================

CREATE TABLE billing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    storage_gb_min NUMERIC(10, 2) NOT NULL DEFAULT 0,
    storage_gb_max NUMERIC(10, 2), -- Nullable = unbounded top tier
    price_per_month NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE studio_billing_status AS ENUM (
    'active',
    'past_due',
    'suspended',
    'comped'
);

CREATE TABLE studio_billing_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID UNIQUE NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    platform_access_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    platform_access_paid_at TIMESTAMPTZ,
    storage_quota_gb NUMERIC(10, 2) NOT NULL DEFAULT 50.0,
    billing_plan_id UUID REFERENCES billing_plans(id) ON DELETE SET NULL,
    custom_price_per_month NUMERIC(10, 2), -- Nullable override
    billing_status studio_billing_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE storage_usage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    storage_provider_id UUID NOT NULL REFERENCES storage_providers(id) ON DELETE CASCADE,
    bytes_used BIGINT NOT NULL DEFAULT 0,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(storage_provider_id, snapshot_date)
);

CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    line_items JSONB NOT NULL DEFAULT '[]', -- [{type, amount, description}]
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status invoice_status NOT NULL DEFAULT 'draft',
    issued_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE billing_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL, -- Positive credit or negative debit
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. Audit Logs & System Tables
-- ==============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID REFERENCES studios(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid tenant lookups & queries
CREATE INDEX idx_studios_slug ON studios(slug);
CREATE INDEX idx_events_studio_status ON events(studio_id, status);
CREATE INDEX idx_events_date ON events(studio_id, event_date_start);
CREATE INDEX idx_folders_studio_parent ON folders(studio_id, parent_folder_id);
CREATE INDEX idx_assets_studio ON assets(studio_id);
CREATE INDEX idx_storage_snapshots_date ON storage_usage_snapshots(studio_id, snapshot_date);
