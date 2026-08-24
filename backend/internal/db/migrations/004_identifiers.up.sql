-- Identificadores v2:
--   CADASTRO (skus.code)     → SKU numérico 6 dígitos (000001)
--   ITEM (inventory_units)   → hex 8 chars — identidade da peça (A1B2C3D4)
--   products                 → dados técnicos PIM, sem código público

-- SKU numérico por cadastro
CREATE SEQUENCE IF NOT EXISTS sku_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_sku_code()
RETURNS CHAR(6) AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('sku_code_seq');
    RETURN LPAD(seq_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Hex por item físico (identidade da peça)
CREATE SEQUENCE IF NOT EXISTS item_hex_seq START 1;

CREATE OR REPLACE FUNCTION generate_item_hex_code()
RETURNS CHAR(8) AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('item_hex_seq');
    RETURN UPPER(LPAD(TO_HEX(seq_val), 8, '0'));
END;
$$ LANGUAGE plpgsql;

-- Reatribui SKUs alfanuméricos existentes para numéricos
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM skus WHERE code !~ '^\d{6}$' ORDER BY created_at LOOP
        UPDATE skus SET code = generate_sku_code() WHERE id = r.id;
    END LOOP;
END $$;

ALTER TABLE skus
    ALTER COLUMN code TYPE CHAR(6) USING code::CHAR(6);

ALTER TABLE skus
    DROP CONSTRAINT IF EXISTS chk_sku_code_format;

ALTER TABLE skus
    ADD CONSTRAINT chk_sku_code_format CHECK (code ~ '^\d{6}$');

COMMENT ON COLUMN skus.code IS 'SKU numérico do cadastro (6 dígitos, ex: 000042)';

-- Remove hex do produto — identidade pública fica no SKU (cadastro) e no item (hex)
ALTER TABLE products DROP COLUMN IF EXISTS hex_code;
DROP FUNCTION IF EXISTS generate_product_hex_code();
DROP SEQUENCE IF EXISTS product_hex_seq;

-- Itens físicos passam a usar hex como código público
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM inventory_units WHERE public_code !~ '^[0-9A-F]{8}$' ORDER BY created_at LOOP
        UPDATE inventory_units SET public_code = generate_item_hex_code() WHERE id = r.id;
    END LOOP;
END $$;

DROP INDEX IF EXISTS idx_units_public_code_trgm;

DROP FUNCTION IF EXISTS generate_unit_public_code() CASCADE;
CREATE OR REPLACE FUNCTION generate_unit_public_code()
RETURNS CHAR(8) AS $$
BEGIN
    RETURN generate_item_hex_code();
END;
$$ LANGUAGE plpgsql;

ALTER TABLE inventory_units
    ALTER COLUMN public_code TYPE CHAR(8) USING UPPER(LPAD(public_code, 8, '0'));

ALTER TABLE inventory_units
    DROP CONSTRAINT IF EXISTS chk_unit_hex_format;

ALTER TABLE inventory_units
    ADD CONSTRAINT chk_unit_hex_format CHECK (public_code ~ '^[0-9A-F]{8}$');

COMMENT ON COLUMN inventory_units.public_code IS 'Identidade hex da peça (8 chars, ex: 00000001)';

-- Sincroniza sequências
SELECT setval('sku_code_seq', GREATEST(COALESCE((SELECT MAX(code::INT) FROM skus), 0), 1));
SELECT setval('item_hex_seq', GREATEST(COALESCE((SELECT COUNT(*) FROM inventory_units), 0), 1));
