CREATE TABLE IF NOT EXISTS stock_intake_batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    sku_id          UUID NOT NULL REFERENCES skus(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    first_unit_code VARCHAR(20),
    last_unit_code  VARCHAR(20),
    purchase_id     UUID REFERENCES purchase_orders(id),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_intake_batch_photos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id    UUID NOT NULL REFERENCES stock_intake_batches(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_batch_photos_batch ON stock_intake_batch_photos(batch_id);

ALTER TABLE inventory_units
    ADD COLUMN IF NOT EXISTS intake_batch_id UUID REFERENCES stock_intake_batches(id);

CREATE INDEX IF NOT EXISTS idx_units_intake_batch ON inventory_units(intake_batch_id);
