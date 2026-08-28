ALTER TYPE rma_resolution ADD VALUE IF NOT EXISTS 'scrap';

ALTER TABLE rma_cases
    ADD COLUMN IF NOT EXISTS test_notes TEXT,
    ADD COLUMN IF NOT EXISTS defect_confirmed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS test_submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS test_submitted_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS rma_test_photos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rma_case_id UUID NOT NULL REFERENCES rma_cases(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rma_test_photos_case ON rma_test_photos (rma_case_id);

CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('rma_warranty_days', '90')
ON CONFLICT (key) DO NOTHING;
