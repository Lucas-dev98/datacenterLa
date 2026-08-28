CREATE TABLE IF NOT EXISTS inventory_unit_intake_photos (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_unit_id UUID NOT NULL UNIQUE REFERENCES inventory_units(id) ON DELETE CASCADE,
    file_path         TEXT NOT NULL,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_intake_photos_unit ON inventory_unit_intake_photos(inventory_unit_id);
