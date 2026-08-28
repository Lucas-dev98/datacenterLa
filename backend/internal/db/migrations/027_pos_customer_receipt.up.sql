-- Cadastro no balcão (paraguaio/estrangeiro) + snapshot do comprador no pedido

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS residency VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(2),
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS document_scan_path TEXT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS buyer_residency VARCHAR(20),
    ADD COLUMN IF NOT EXISTS buyer_nationality VARCHAR(2),
    ADD COLUMN IF NOT EXISTS buyer_document_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS buyer_document_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customers_document_id
    ON customers (document_id)
    WHERE document_id IS NOT NULL AND document_id <> '';
