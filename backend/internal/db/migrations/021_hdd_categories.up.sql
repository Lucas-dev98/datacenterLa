-- HDD: formatos, interfaces e tipos + atributos (capacidade, endurance, interface, RPM)

UPDATE categories SET is_active = false
WHERE code IN ('HDD_3_5', 'HDD_2_5', 'HDD_SAS');

INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('HDD_3_5_SATA', 'HDD 3.5" SATA'),
    ('HDD_3_5_SAS', 'HDD 3.5" SAS Enterprise'),
    ('HDD_3_5_NL_SAS', 'HDD 3.5" Nearline (NL-SAS)'),
    ('HDD_2_5_SATA', 'HDD 2.5" SATA'),
    ('HDD_2_5_SAS', 'HDD 2.5" SAS'),
    ('HDD_2_5_PERF', 'HDD 2.5" Performance (10K / 15K)')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'HDD'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, a.code, a.name, a.data_type, a.is_required, a.sort_order
FROM categories c
CROSS JOIN (VALUES
    ('capacidade', 'Capacidade', 'text', true, 1),
    ('perfil_endurance', 'Perfil de endurance (RI / WI / MU)', 'text', true, 2),
    ('interface', 'Interface (SATA / SAS)', 'text', false, 3),
    ('rpm', 'RPM', 'text', false, 4),
    ('tipo_disco', 'Tipo (Nearline / Enterprise / Performance)', 'text', false, 5)
) AS a(code, name, data_type, is_required, sort_order)
WHERE c.code IN (
    'HDD_3_5_SATA', 'HDD_3_5_SAS', 'HDD_3_5_NL_SAS',
    'HDD_2_5_SATA', 'HDD_2_5_SAS', 'HDD_2_5_PERF'
)
AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.code = a.code
);
