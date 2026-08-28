-- Equipamentos de storage (NAS/SAN/JBOD) e switches — separados de discos e NICs.

INSERT INTO categories (code, name, parent_id, is_active)
VALUES
    ('STORAGE', 'Storage', NULL, true),
    ('SWITCH', 'Switch', NULL, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = NULL,
    is_active = true;

INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('STG_NAS', 'NAS'),
    ('STG_SAN', 'SAN'),
    ('STG_DAS', 'DAS / JBOD')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'STORAGE'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('SW_ACCESS', 'Switch de acesso'),
    ('SW_DATACENTER', 'Switch datacenter')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'SWITCH'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, a.code, a.name, 'text', a.required, a.sort_order
FROM categories c
CROSS JOIN (VALUES
    ('form_factor', 'Form factor', true, 1),
    ('baias', 'Baias / capacidade', true, 2),
    ('protocolo', 'Protocolo / interface', true, 3)
) AS a(code, name, required, sort_order)
WHERE c.code IN ('STG_NAS', 'STG_SAN', 'STG_DAS')
  AND NOT EXISTS (
      SELECT 1 FROM category_attributes ca
      WHERE ca.category_id = c.id AND ca.code = a.code
  );

INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, a.code, a.name, 'text', a.required, a.sort_order
FROM categories c
CROSS JOIN (VALUES
    ('form_factor', 'Form factor', true, 1),
    ('portas', 'Portas', true, 2),
    ('velocidade', 'Velocidade', true, 3)
) AS a(code, name, required, sort_order)
WHERE c.code IN ('SW_ACCESS', 'SW_DATACENTER')
  AND NOT EXISTS (
      SELECT 1 FROM category_attributes ca
      WHERE ca.category_id = c.id AND ca.code = a.code
  );
