-- Unidade física: código sequencial AAA0001 (não hex)
-- Cadastro: SKU numérico 000042 (inalterado)

DROP FUNCTION IF EXISTS generate_item_hex_code();
DROP FUNCTION IF EXISTS generate_unit_public_code() CASCADE;
DROP SEQUENCE IF EXISTS item_hex_seq;

CREATE SEQUENCE IF NOT EXISTS inventory_unit_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_unit_public_code()
RETURNS VARCHAR(20) AS $$
DECLARE seq_val BIGINT;
BEGIN
    seq_val := nextval('inventory_unit_code_seq');
    RETURN 'AAA' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Reatribui códigos que não seguem padrão AAA
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM inventory_units WHERE public_code !~ '^AAA[0-9]{4,}$' ORDER BY created_at LOOP
        UPDATE inventory_units SET public_code = generate_unit_public_code() WHERE id = r.id;
    END LOOP;
END $$;

ALTER TABLE inventory_units
    ALTER COLUMN public_code TYPE VARCHAR(20);

ALTER TABLE inventory_units
    DROP CONSTRAINT IF EXISTS chk_unit_hex_format;

ALTER TABLE inventory_units
    DROP CONSTRAINT IF EXISTS chk_unit_code_format;

ALTER TABLE inventory_units
    ADD CONSTRAINT chk_unit_code_format CHECK (public_code ~ '^AAA[0-9]{4,}$');

COMMENT ON COLUMN inventory_units.public_code IS 'Código da unidade no estoque (ex: AAA0001, AAA0002)';

SELECT setval('inventory_unit_code_seq', GREATEST(
    COALESCE((SELECT MAX(SUBSTRING(public_code FROM 4)::INT) FROM inventory_units WHERE public_code ~ '^AAA[0-9]+$'), 0),
    1
));

CREATE INDEX IF NOT EXISTS idx_units_public_code_trgm ON inventory_units USING gin (public_code gin_trgm_ops);
