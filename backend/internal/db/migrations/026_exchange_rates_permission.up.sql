-- Permissão para atualizar cotações diárias (Financeiro)

INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb020', 'finance.exchange_rates.write', 'Atualizar cotações do dia', 'finance')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code = 'finance.exchange_rates.write'
  AND r.code IN ('admin', 'management', 'finance')
ON CONFLICT DO NOTHING;
