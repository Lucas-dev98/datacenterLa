INSERT INTO permissions (id, code, name, module) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb015', 'sales.orders.cancel', 'Cancelar pedidos', 'sales')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('admin', 'management', 'finance')
  AND p.code = 'sales.orders.cancel'
ON CONFLICT DO NOTHING;
