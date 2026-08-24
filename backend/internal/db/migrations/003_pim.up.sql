CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    parent_id   UUID REFERENCES categories(id),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE category_attributes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    code         VARCHAR(50) NOT NULL,
    name         VARCHAR(100) NOT NULL,
    data_type    VARCHAR(20) NOT NULL DEFAULT 'text',
    is_required  BOOLEAN NOT NULL DEFAULT false,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, code),
    CONSTRAINT chk_attribute_data_type CHECK (data_type IN ('text', 'number', 'boolean'))
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS generated_description TEXT,
    ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
    ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_category'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT fk_products_category
            FOREIGN KEY (category_id) REFERENCES categories(id);
    END IF;
END $$;

CREATE TABLE product_attribute_values (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_attribute_id UUID NOT NULL REFERENCES category_attributes(id) ON DELETE CASCADE,
    value_text            TEXT,
    value_number          NUMERIC(18,4),
    value_boolean         BOOLEAN,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, category_attribute_id)
);

CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_active ON products (is_active) WHERE is_active = true;
CREATE INDEX idx_skus_code ON skus (code);
CREATE INDEX idx_category_attributes_category ON category_attributes (category_id);

ALTER TABLE skus
    ADD COLUMN IF NOT EXISTS publish_compras_paraguai BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS publish_ecommerce BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON TABLE categories IS 'Categorias PIM — definem atributos dinâmicos';
COMMENT ON TABLE category_attributes IS 'Atributos por categoria (capacidade, tecnologia, etc.)';
COMMENT ON TABLE product_attribute_values IS 'Valores dos atributos por produto';
