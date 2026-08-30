CREATE TABLE IF NOT EXISTS intake_test_photos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_unit_id UUID NOT NULL REFERENCES inventory_units(id) ON DELETE CASCADE,
    file_path         TEXT NOT NULL,
    created_by        UUID NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_test_photos_unit ON intake_test_photos(inventory_unit_id);

CREATE TYPE supplier_return_status AS ENUM ('open', 'sent', 'closed', 'cancelled');

CREATE TABLE IF NOT EXISTS supplier_return_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id       UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    inventory_unit_id UUID NOT NULL REFERENCES inventory_units(id),
    sku_id            UUID NOT NULL REFERENCES skus(id),
    reason            TEXT NOT NULL,
    status            supplier_return_status NOT NULL DEFAULT 'open',
    created_by        UUID NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_returns_status ON supplier_return_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_returns_unit ON supplier_return_requests(inventory_unit_id);
