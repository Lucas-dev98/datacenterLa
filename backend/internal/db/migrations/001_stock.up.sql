CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE skus (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouses (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    branch_id   UUID,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    code         VARCHAR(50) NOT NULL,
    aisle        VARCHAR(10),
    rack         VARCHAR(10),
    shelf        VARCHAR(10),
    position     VARCHAR(10),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (warehouse_id, code)
);

CREATE TYPE unit_status AS ENUM (
    'received', 'inspecting', 'identified', 'available', 'reserved', 'picking',
    'sold', 'in_transit', 'returned', 'warranty', 'rma', 'damaged', 'blocked', 'written_off'
);

CREATE SEQUENCE inventory_unit_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_unit_public_code()
RETURNS VARCHAR AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('inventory_unit_code_seq');
    RETURN 'AAA' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE inventory_units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_code     VARCHAR(20) NOT NULL UNIQUE,
    sku_id          UUID NOT NULL REFERENCES skus(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    location_id     UUID REFERENCES locations(id),
    status          unit_status NOT NULL DEFAULT 'received',
    purchase_id     UUID,
    unit_cost_usd   NUMERIC(12,2),
    received_at     TIMESTAMPTZ,
    available_at    TIMESTAMPTZ,
    sold_at         TIMESTAMPTZ,
    order_id        UUID,
    order_item_id   UUID,
    reservation_id  UUID,
    serial_number   VARCHAR(100),
    notes           TEXT,
    version         INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_units_sku_status ON inventory_units (sku_id, status);
CREATE INDEX idx_units_warehouse_status ON inventory_units (warehouse_id, status);
CREATE INDEX idx_units_location ON inventory_units (location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_units_public_code_trgm ON inventory_units USING gin (public_code gin_trgm_ops);

CREATE TYPE movement_type AS ENUM (
    'purchase_in', 'return_in', 'transfer_in', 'adjustment_in', 'sale_out', 'transfer_out',
    'supplier_return', 'damage_out', 'adjustment_out', 'reserve', 'release',
    'status_change', 'reversal'
);

CREATE TABLE stock_movements (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type         movement_type NOT NULL,
    sku_id                UUID NOT NULL REFERENCES skus(id),
    warehouse_id          UUID NOT NULL REFERENCES warehouses(id),
    inventory_unit_id     UUID REFERENCES inventory_units(id),
    quantity              INT NOT NULL DEFAULT 1,
    unit_status_before    unit_status,
    unit_status_after     unit_status,
    reference_type        VARCHAR(50),
    reference_id          UUID,
    reason                TEXT,
    notes                 TEXT,
    created_by            UUID NOT NULL,
    approved_by           UUID,
    reversed_by_movement_id UUID REFERENCES stock_movements(id),
    idempotency_key       VARCHAR(100) UNIQUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_sku_wh ON stock_movements (sku_id, warehouse_id, created_at);
CREATE INDEX idx_movements_unit ON stock_movements (inventory_unit_id);
CREATE INDEX idx_movements_reference ON stock_movements (reference_type, reference_id);

CREATE TYPE reservation_status AS ENUM ('active', 'fulfilled', 'released', 'expired');

CREATE TABLE stock_reservations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id          UUID NOT NULL,
    order_item_id     UUID NOT NULL,
    sku_id            UUID NOT NULL REFERENCES skus(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    inventory_unit_id UUID REFERENCES inventory_units(id),
    quantity          INT NOT NULL DEFAULT 1,
    status            reservation_status NOT NULL DEFAULT 'active',
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at       TIMESTAMPTZ,
    fulfilled_at      TIMESTAMPTZ
);

CREATE INDEX idx_reservations_active ON stock_reservations (sku_id, warehouse_id) WHERE status = 'active';
CREATE INDEX idx_reservations_order ON stock_reservations (order_id);
CREATE INDEX idx_reservations_expires ON stock_reservations (expires_at) WHERE status = 'active';

CREATE TABLE stock_balances (
    sku_id        UUID NOT NULL REFERENCES skus(id),
    warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
    qty_physical  INT NOT NULL DEFAULT 0,
    qty_reserved  INT NOT NULL DEFAULT 0,
    qty_available INT GENERATED ALWAYS AS (qty_physical - qty_reserved) STORED,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sku_id, warehouse_id),
    CONSTRAINT chk_physical_non_negative CHECK (qty_physical >= 0),
    CONSTRAINT chk_reserved_non_negative CHECK (qty_reserved >= 0),
    CONSTRAINT chk_reserved_lte_physical CHECK (qty_reserved <= qty_physical)
);

CREATE TYPE count_status AS ENUM ('draft', 'in_progress', 'pending_review', 'approved', 'cancelled');

CREATE TABLE stock_counts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    count_type   VARCHAR(30) NOT NULL,
    filter_json  JSONB,
    status       count_status NOT NULL DEFAULT 'draft',
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by   UUID NOT NULL,
    approved_by  UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_count_lines (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_count_id    UUID NOT NULL REFERENCES stock_counts(id),
    inventory_unit_id UUID REFERENCES inventory_units(id),
    sku_id            UUID REFERENCES skus(id),
    location_id       UUID REFERENCES locations(id),
    system_qty        INT NOT NULL DEFAULT 0,
    counted_qty       INT,
    variance          INT GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - system_qty) STORED,
    recount_qty       INT,
    status            VARCHAR(20) DEFAULT 'pending',
    notes             TEXT
);

CREATE TYPE adjustment_status AS ENUM ('pending', 'approved', 'rejected', 'applied', 'cancelled');

CREATE TABLE stock_adjustments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
    sku_id              UUID REFERENCES skus(id),
    inventory_unit_id   UUID REFERENCES inventory_units(id),
    quantity_delta      INT NOT NULL,
    estimated_value_usd NUMERIC(12,2),
    reason              TEXT NOT NULL,
    status              adjustment_status NOT NULL DEFAULT 'pending',
    stock_count_id      UUID REFERENCES stock_counts(id),
    requested_by        UUID NOT NULL,
    approved_by         UUID,
    second_approved_by  UUID,
    applied_movement_id UUID REFERENCES stock_movements(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE health_issue_type AS ENUM (
    'sold_but_available', 'duplicate_code', 'reservation_orphan', 'negative_balance',
    'missing_location', 'status_mismatch', 'ghost_system', 'ghost_physical'
);

CREATE TYPE health_issue_status AS ENUM ('open', 'investigating', 'resolved', 'ignored');

CREATE TABLE stock_health_issues (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_type        health_issue_type NOT NULL,
    status            health_issue_status NOT NULL DEFAULT 'open',
    inventory_unit_id UUID REFERENCES inventory_units(id),
    sku_id            UUID REFERENCES skus(id),
    warehouse_id      UUID REFERENCES warehouses(id),
    details           JSONB NOT NULL,
    detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ,
    resolved_by       UUID,
    resolution_notes  TEXT
);

CREATE INDEX idx_health_open ON stock_health_issues (status, issue_type) WHERE status = 'open';

CREATE TABLE outbox_events (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type   VARCHAR(100) NOT NULL,
    payload      JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unpublished ON outbox_events (created_at) WHERE published_at IS NULL;
