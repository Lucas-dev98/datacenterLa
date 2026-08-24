CREATE TYPE supplier_status AS ENUM ('active', 'inactive');
CREATE TYPE purchase_order_status AS ENUM ('draft', 'ordered', 'partial', 'received', 'cancelled');

CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(50),
    document_id VARCHAR(50),
    country     VARCHAR(2) DEFAULT 'PY',
    status      supplier_status NOT NULL DEFAULT 'active',
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number       VARCHAR(20) NOT NULL UNIQUE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          purchase_order_status NOT NULL DEFAULT 'draft',
    expected_at     DATE,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    ordered_at      TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE purchase_order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('purchase_order_number_seq');
    RETURN 'PO-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE purchase_order_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sku_id              UUID NOT NULL REFERENCES skus(id),
    quantity_ordered    INT NOT NULL CHECK (quantity_ordered > 0),
    quantity_received   INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost_usd       NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (purchase_order_id, sku_id)
);

CREATE INDEX idx_purchase_orders_supplier ON purchase_orders (supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders (status);

UPDATE inventory_units SET purchase_id = NULL WHERE purchase_id IS NOT NULL;

ALTER TABLE inventory_units
    ADD CONSTRAINT fk_inventory_units_purchase
    FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id);

INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb019', 'purchases.read', 'Consultar compras', 'purchases'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb01a', 'purchases.write', 'Gerenciar compras', 'purchases'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb01b', 'purchases.receive', 'Receber compras', 'purchases');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('admin', 'management', 'stock')
  AND p.code IN ('purchases.read', 'purchases.write', 'purchases.receive');
