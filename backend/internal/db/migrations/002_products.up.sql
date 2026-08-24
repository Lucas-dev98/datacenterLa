CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hex_code    CHAR(8) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    category_id UUID,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_hex_code_format CHECK (hex_code ~ '^[0-9A-F]{8}$')
);

CREATE SEQUENCE product_hex_seq START 1;

CREATE OR REPLACE FUNCTION generate_product_hex_code()
RETURNS CHAR(8) AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('product_hex_seq');
    RETURN UPPER(LPAD(TO_HEX(seq_val), 8, '0'));
END;
$$ LANGUAGE plpgsql;

CREATE INDEX idx_products_hex_code ON products (hex_code);

ALTER TABLE skus
    ADD COLUMN product_id UUID REFERENCES products(id),
    ADD COLUMN description TEXT;

CREATE INDEX idx_skus_product_id ON skus (product_id);

COMMENT ON TABLE products IS 'Definição técnica do item — identidade estável via hex_code';
COMMENT ON COLUMN products.hex_code IS 'Código hexadecimal único do produto (8 chars, ex: 00000001, A1B2C3D4)';
COMMENT ON TABLE skus IS 'Cadastro comercial — cada cadastro possui exatamente um SKU';
COMMENT ON COLUMN skus.code IS 'Código SKU comercial (ex: RAM-SAM-DDR4-32-3200-ECC)';
COMMENT ON COLUMN inventory_units.public_code IS 'Código da unidade física no estoque (ex: AAA0001)';
