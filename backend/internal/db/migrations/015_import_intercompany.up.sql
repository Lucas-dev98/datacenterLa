-- Importação intercompany (holding China / EUA) registrada como compra fiscal

CREATE TYPE supplier_kind AS ENUM ('external', 'intercompany');
CREATE TYPE import_origin AS ENUM ('local', 'china', 'usa');

ALTER TABLE suppliers
    ADD COLUMN kind supplier_kind NOT NULL DEFAULT 'external',
    ADD COLUMN legal_name VARCHAR(255),
    ADD COLUMN holding_code VARCHAR(30);

CREATE INDEX idx_suppliers_kind ON suppliers (kind);

ALTER TABLE purchase_orders
    ADD COLUMN import_origin import_origin NOT NULL DEFAULT 'local',
    ADD COLUMN intercompany_invoice_ref VARCHAR(100),
    ADD COLUMN customs_declaration_ref VARCHAR(100),
    ADD COLUMN incoterms VARCHAR(20),
    ADD COLUMN freight_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN duties_usd NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX idx_purchase_orders_import_origin ON purchase_orders (import_origin);

-- Entidades do grupo no exterior exportam para Data Center LA (Paraguai); entrada fiscal como compra
INSERT INTO suppliers (id, code, name, legal_name, country, kind, holding_code, notes)
VALUES
    ('77777777-7777-7777-7777-777777777001', 'EXPORT-CN',
     'Hailian Xinke Trading (Shenzhen) Co., Ltd.', 'Hailian Xinke Trading (Shenzhen) Co., Ltd.',
     'CN', 'intercompany', 'EXPORT-CN',
     'Empresa do grupo na China. Exporta mercadoria para Data Center LA (Paraguai). Entrada fiscal local registrada como compra intercompany.'),
    ('77777777-7777-7777-7777-777777777002', 'EXPORT-US',
     'Summit Bridge Technologies LLC', 'Summit Bridge Technologies LLC',
     'US', 'intercompany', 'EXPORT-US',
     'Empresa do grupo nos EUA. Exporta mercadoria para Data Center LA (Paraguai). Entrada fiscal local registrada como compra intercompany.')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    legal_name = EXCLUDED.legal_name,
    country = EXCLUDED.country,
    kind = EXCLUDED.kind,
    holding_code = EXCLUDED.holding_code,
    notes = EXCLUDED.notes;
