-- CRM, Sales, Finance, E-commerce

CREATE TYPE customer_type AS ENUM ('b2c', 'b2b', 'reseller');
CREATE TYPE sales_channel AS ENUM ('erp', 'ecommerce');
CREATE TYPE quote_status AS ENUM (
    'draft', 'sent', 'viewed', 'negotiating', 'approved', 'rejected', 'expired', 'converted'
);
CREATE TYPE order_status AS ENUM (
    'draft', 'confirmed', 'paid', 'picking', 'shipped', 'delivered', 'cancelled'
);
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE receivable_status AS ENUM ('open', 'partial', 'paid', 'cancelled');

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            customer_type NOT NULL DEFAULT 'b2b',
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    document_id     VARCHAR(50),
    credit_limit_usd NUMERIC(12,2) DEFAULT 0,
    payment_terms_days INT DEFAULT 30,
    responsible_seller_id UUID REFERENCES users(id),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number    VARCHAR(20) NOT NULL UNIQUE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    seller_id       UUID NOT NULL REFERENCES users(id),
    status          quote_status NOT NULL DEFAULT 'draft',
    channel         sales_channel NOT NULL DEFAULT 'erp',
    valid_until     TIMESTAMPTZ,
    discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    sent_at         TIMESTAMPTZ,
    converted_order_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE quote_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR AS $$
BEGIN
    RETURN 'COT-' || LPAD(nextval('quote_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE quote_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    sku_id          UUID NOT NULL REFERENCES skus(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    unit_price_usd  NUMERIC(12,2) NOT NULL,
    discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    line_total_usd  NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number    VARCHAR(20) NOT NULL UNIQUE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    quote_id        UUID REFERENCES quotes(id),
    seller_id       UUID REFERENCES users(id),
    channel         sales_channel NOT NULL DEFAULT 'erp',
    status          order_status NOT NULL DEFAULT 'draft',
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal_usd    NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_usd       NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    confirmed_at    TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE order_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $$
BEGIN
    RETURN 'PED-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku_id          UUID NOT NULL REFERENCES skus(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    unit_price_usd  NUMERIC(12,2) NOT NULL,
    discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    line_total_usd  NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    amount_usd      NUMERIC(12,2) NOT NULL,
    method          VARCHAR(50) NOT NULL DEFAULT 'transfer',
    status          payment_status NOT NULL DEFAULT 'pending',
    reference       VARCHAR(100),
    recorded_by     UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts_receivable (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    amount_usd      NUMERIC(12,2) NOT NULL,
    paid_usd        NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date        DATE NOT NULL,
    status          receivable_status NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ecommerce_carts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      VARCHAR(64) NOT NULL UNIQUE,
    customer_id     UUID REFERENCES customers(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ecommerce_cart_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id         UUID NOT NULL REFERENCES ecommerce_carts(id) ON DELETE CASCADE,
    sku_id          UUID NOT NULL REFERENCES skus(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, sku_id)
);

CREATE INDEX idx_quotes_customer ON quotes (customer_id);
CREATE INDEX idx_quotes_status ON quotes (status);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_payments_order ON payments (order_id);
CREATE INDEX idx_receivables_customer ON accounts_receivable (customer_id, status);
