-- Pricing per SKU

CREATE TABLE sku_prices (
    sku_id          UUID PRIMARY KEY REFERENCES skus(id) ON DELETE CASCADE,
    cost_usd        NUMERIC(12,2),
    min_price_usd   NUMERIC(12,2),
    price_b2c_usd   NUMERIC(12,2),
    price_b2b_usd   NUMERIC(12,2),
    price_reseller_usd NUMERIC(12,2),
    price_promo_usd NUMERIC(12,2),
    promo_starts_at TIMESTAMPTZ,
    promo_ends_at   TIMESTAMPTZ,
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id          UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    field_name      VARCHAR(50) NOT NULL,
    old_value       NUMERIC(12,2),
    new_value       NUMERIC(12,2),
    changed_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_sku ON price_history (sku_id, created_at DESC);

CREATE TABLE exchange_rates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency CHAR(3) NOT NULL DEFAULT 'USD',
    to_currency   CHAR(3) NOT NULL DEFAULT 'PYG',
    rate        NUMERIC(18,4) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_currency, to_currency, effective_date)
);

INSERT INTO exchange_rates (rate) VALUES (7500);
