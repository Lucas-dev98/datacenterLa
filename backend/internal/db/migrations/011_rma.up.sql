CREATE TYPE rma_status AS ENUM (
    'requested', 'approved', 'received', 'inspecting', 'resolved', 'rejected', 'cancelled'
);

CREATE TYPE rma_resolution AS ENUM (
    'restock', 'warranty', 'refund', 'replace', 'reject'
);

CREATE TABLE rma_cases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number     VARCHAR(30) NOT NULL UNIQUE,
    order_id        UUID NOT NULL REFERENCES orders(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    status          rma_status NOT NULL DEFAULT 'requested',
    reason          TEXT NOT NULL,
    resolution      rma_resolution,
    notes           TEXT,
    requested_by    UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    resolved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE rma_case_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_rma_case_number()
RETURNS VARCHAR(30) AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('rma_case_number_seq');
    RETURN 'RMA-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE rma_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rma_case_id         UUID NOT NULL REFERENCES rma_cases(id) ON DELETE CASCADE,
    order_item_id       UUID REFERENCES order_items(id),
    sku_id              UUID NOT NULL REFERENCES skus(id),
    inventory_unit_id   UUID REFERENCES inventory_units(id),
    quantity            INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    condition_notes     TEXT
);

CREATE INDEX idx_rma_cases_order ON rma_cases (order_id);
CREATE INDEX idx_rma_cases_status ON rma_cases (status);

INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb016', 'inventory.count', 'Inventário físico', 'stock'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb017', 'inventory.adjust', 'Ajustes de estoque', 'stock'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb018', 'sales.rma.write', 'Gerenciar devoluções/RMA', 'sales')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('admin', 'management', 'stock')
  AND p.code IN ('inventory.count', 'inventory.adjust')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('admin', 'management', 'seller', 'finance')
  AND p.code = 'sales.rma.write'
ON CONFLICT DO NOTHING;
