CREATE TYPE customer_return_status AS ENUM (
    'requested', 'approved', 'received', 'resolved', 'rejected', 'cancelled'
);

CREATE TYPE customer_return_resolution AS ENUM (
    'restock', 'refund', 'reject'
);

CREATE TABLE customer_returns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number   VARCHAR(30) NOT NULL UNIQUE,
    order_id        UUID NOT NULL REFERENCES orders(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    status          customer_return_status NOT NULL DEFAULT 'requested',
    reason          TEXT NOT NULL,
    condition_notes TEXT,
    resolution      customer_return_resolution,
    notes           TEXT,
    requested_by    UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    resolved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE customer_return_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_customer_return_number()
RETURNS VARCHAR(30) AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('customer_return_number_seq');
    RETURN 'DEV-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE customer_return_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id           UUID NOT NULL REFERENCES customer_returns(id) ON DELETE CASCADE,
    order_item_id       UUID REFERENCES order_items(id),
    sku_id              UUID NOT NULL REFERENCES skus(id),
    inventory_unit_id   UUID REFERENCES inventory_units(id),
    quantity            INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    condition_notes     TEXT
);

CREATE TABLE customer_return_photos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id   UUID NOT NULL REFERENCES customer_returns(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_returns_order ON customer_returns (order_id);
CREATE INDEX idx_customer_returns_status ON customer_returns (status);
CREATE INDEX idx_customer_return_photos_return ON customer_return_photos (return_id);

INSERT INTO app_settings (key, value)
VALUES ('return_window_days', '7')
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb021', 'sales.returns.write', 'Gerenciar devoluções de clientes', 'sales')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('admin', 'management', 'seller', 'finance')
  AND p.code = 'sales.returns.write'
ON CONFLICT DO NOTHING;
