-- Auth: users, roles, permissions, sessions, MFA

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
    mfa_secret      VARCHAR(64),
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(100) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    module      VARCHAR(50) NOT NULL
);

CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- Seed roles
INSERT INTO roles (id, code, name) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'admin', 'Administrador'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'management', 'Gerência'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'seller', 'Vendedor'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'stock', 'Estoque'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'finance', 'Financeiro');

-- Seed permissions
INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'auth.users.manage', 'Gerenciar usuários', 'auth'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'pim.products.read', 'Ver produtos', 'pim'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'pim.products.write', 'Editar produtos', 'pim'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', 'pim.prices.read', 'Ver preços', 'pricing'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005', 'pim.prices.write', 'Alterar preços', 'pricing'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006', 'inventory.receive', 'Receber estoque', 'stock'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007', 'inventory.read', 'Consultar estoque', 'stock'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008', 'sales.quotes.write', 'Criar cotações', 'sales'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 'sales.orders.write', 'Criar pedidos', 'sales'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb010', 'sales.orders.confirm', 'Confirmar pedidos', 'sales'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011', 'crm.customers.write', 'Gerenciar clientes', 'crm'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012', 'finance.payments.write', 'Registrar pagamentos', 'finance'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb013', 'finance.receivables.read', 'Ver contas a receber', 'finance'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb014', 'labels.batch', 'Impressão em lote', 'labels');

-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', id FROM permissions;

-- Management: most except auth.users.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', id FROM permissions
WHERE code NOT IN ('auth.users.manage');

-- Seller
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', id FROM permissions
WHERE code IN (
    'pim.products.read', 'pim.prices.read', 'inventory.read',
    'sales.quotes.write', 'sales.orders.write', 'crm.customers.write', 'labels.batch'
);

-- Stock
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', id FROM permissions
WHERE code IN ('pim.products.read', 'inventory.receive', 'inventory.read', 'labels.batch');

-- Finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', id FROM permissions
WHERE code IN (
    'pim.prices.read', 'sales.orders.confirm', 'finance.payments.write',
    'finance.receivables.read', 'crm.customers.write'
);

-- Dev admin user seeded via cmd/seed (admin@datacenterla.local)
