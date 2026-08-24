-- PDV: cliente consumidor final + permissão de venda balcão

INSERT INTO customers (id, type, name, email, credit_limit_usd, payment_terms_days, is_active)
VALUES (
    '77777777-7777-7777-7777-777777777001',
    'b2c',
    'Consumidor final (balcão)',
    NULL,
    0,
    0,
    true
)
ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    name = EXCLUDED.name,
    is_active = true;

INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb01f', 'sales.pos.write', 'PDV — venda balcão', 'sales')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code = 'sales.pos.write'
  AND r.code IN ('admin', 'management', 'seller')
ON CONFLICT DO NOTHING;
