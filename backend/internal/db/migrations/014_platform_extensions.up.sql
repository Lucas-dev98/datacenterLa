CREATE TYPE payment_intent_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TABLE payment_intents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    amount_usd      NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    provider        VARCHAR(30) NOT NULL DEFAULT 'mock',
    status          payment_intent_status NOT NULL DEFAULT 'pending',
    client_secret   VARCHAR(64) NOT NULL UNIQUE,
    provider_ref    VARCHAR(255),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_payment_intents_order ON payment_intents (order_id);
CREATE INDEX idx_payment_intents_status ON payment_intents (status) WHERE status = 'pending';

ALTER TABLE skus ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'lost', 'converted');
CREATE TYPE payable_status AS ENUM ('open', 'partial', 'paid', 'cancelled');

CREATE TABLE crm_leads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(50),
    company     VARCHAR(255),
    source      VARCHAR(50) DEFAULT 'web',
    status      lead_status NOT NULL DEFAULT 'new',
    notes       TEXT,
    owner_id    UUID REFERENCES users(id),
    customer_id UUID REFERENCES customers(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts_payable (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    description     TEXT NOT NULL,
    amount_usd      NUMERIC(12,2) NOT NULL,
    amount_paid_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date        DATE,
    status          payable_status NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb01c', 'crm.leads.write', 'Gerenciar leads', 'crm'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb01d', 'finance.payables.read', 'Ver contas a pagar', 'finance'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb01e', 'finance.payables.write', 'Registrar pagamentos a pagar', 'finance');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.code = 'admin' AND p.code IN ('crm.leads.write', 'finance.payables.read', 'finance.payables.write'))
   OR (r.code = 'management' AND p.code IN ('crm.leads.write', 'finance.payables.read'))
   OR (r.code = 'seller' AND p.code = 'crm.leads.write')
   OR (r.code = 'finance' AND p.code IN ('finance.payables.read', 'finance.payables.write'));
