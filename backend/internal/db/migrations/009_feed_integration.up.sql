-- Feed Compras Paraguai: localização ES, log de sync, cache e fila de entrega

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS name_es TEXT,
    ADD COLUMN IF NOT EXISTS description_es TEXT,
    ADD COLUMN IF NOT EXISTS generated_description_es TEXT;

COMMENT ON COLUMN products.name_es IS 'Nome do produto em espanhol (feed Compras Paraguai)';
COMMENT ON COLUMN products.description_es IS 'Descrição longa em espanhol';
COMMENT ON COLUMN products.generated_description_es IS 'Descrição curta gerada/traduzida para etiqueta e feed ES';

CREATE TYPE feed_sync_status AS ENUM ('success', 'partial', 'failed');

CREATE TABLE feed_sync_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel         VARCHAR(50) NOT NULL DEFAULT 'compras_paraguai',
    status          feed_sync_status NOT NULL,
    item_count      INT NOT NULL DEFAULT 0,
    skipped_count   INT NOT NULL DEFAULT 0,
    content_hash    VARCHAR(64),
    duration_ms     INT,
    trigger_source  VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_sync_logs_created ON feed_sync_logs (created_at DESC);

CREATE TABLE feed_sync_log_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_log_id     UUID NOT NULL REFERENCES feed_sync_logs(id) ON DELETE CASCADE,
    sku_code        VARCHAR(20) NOT NULL,
    action          VARCHAR(20) NOT NULL,
    reason          TEXT,
    changes         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_sync_log_entries_sync ON feed_sync_log_entries (sync_log_id);

CREATE TABLE feed_cache (
    channel         VARCHAR(50) PRIMARY KEY,
    xml_content     TEXT NOT NULL,
    content_hash    VARCHAR(64) NOT NULL,
    item_count      INT NOT NULL DEFAULT 0,
    skipped_count   INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feed_delivery_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_log_id     UUID NOT NULL REFERENCES feed_sync_logs(id) ON DELETE CASCADE,
    target_url      TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts        INT NOT NULL DEFAULT 0,
    max_attempts    INT NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_delivery_pending ON feed_delivery_jobs (next_retry_at)
    WHERE status IN ('pending', 'retry');
