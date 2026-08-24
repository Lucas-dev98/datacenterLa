-- Placas de rede: HBA, SFP, SFP+ e velocidades

UPDATE categories SET is_active = false
WHERE code IN ('REDE_1G', 'REDE_10G', 'REDE_FIBRA', 'REDE_WIFI');

INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('REDE_RJ45_1G', 'Ethernet 1Gb RJ45'),
    ('REDE_SFP_1G', 'Placa SFP 1G'),
    ('REDE_SFP_PLUS', 'Placa SFP+ 10G'),
    ('REDE_SFP28', 'Placa SFP28 25G'),
    ('REDE_QSFP28', 'Placa QSFP28 40/100G'),
    ('REDE_HBA_FC', 'HBA Fibre Channel'),
    ('REDE_HBA_SAS', 'HBA SAS'),
    ('REDE_WIFI', 'Placa Wi-Fi')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'PLACA_REDE'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, a.code, a.name, a.data_type, a.is_required, a.sort_order
FROM categories c
CROSS JOIN (VALUES
    ('velocidade', 'Velocidade / taxa de transferência', 'text', true, 1),
    ('tipo_conector', 'Tipo de conector / módulo', 'text', true, 2),
    ('portas', 'Número de portas', 'text', true, 3),
    ('protocolo', 'Protocolo', 'text', true, 4)
) AS a(code, name, data_type, is_required, sort_order)
WHERE c.code IN (
    'REDE_RJ45_1G', 'REDE_SFP_1G', 'REDE_SFP_PLUS', 'REDE_SFP28', 'REDE_QSFP28',
    'REDE_HBA_FC', 'REDE_HBA_SAS', 'REDE_WIFI'
)
AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.code = a.code
);
