ALTER TYPE import_origin ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS origin_country_code VARCHAR(2);
