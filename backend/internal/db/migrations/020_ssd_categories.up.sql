-- SSD: form factors / interfaces + atributo endurance (RI, WI, MU)

UPDATE categories SET is_active = false
WHERE code IN ('SSD_NVME', 'SSD_SATA', 'SSD_ENTERPRISE');

INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('SSD_M2_NVME', 'SSD M.2 NVMe'),
    ('SSD_SATA', 'SSD SATA'),
    ('SSD_SAS', 'SSD SAS'),
    ('SSD_U2', 'SSD U.2'),
    ('SSD_E1S', 'SSD E1.S'),
    ('SSD_E3S', 'SSD E3.S'),
    ('SSD_PCIE_GEN5_AI', 'SSD PCIe Gen5 — otimizado para IA')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'SSD'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- Capacidade em todas as subcategorias SSD ativas
INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, 'capacidade', 'Capacidade', 'text', true, 1
FROM categories c
WHERE c.code IN (
    'SSD_M2_NVME', 'SSD_SATA', 'SSD_SAS', 'SSD_U2', 'SSD_E1S', 'SSD_E3S', 'SSD_PCIE_GEN5_AI'
)
AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.code = 'capacidade'
);

-- Perfil de endurance: RI (Read Intensive), WI (Write Intensive), MU (Mixed Use)
INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, 'perfil_endurance', 'Perfil de endurance (RI / WI / MU)', 'text', true, 2
FROM categories c
WHERE c.code IN (
    'SSD_M2_NVME', 'SSD_SATA', 'SSD_SAS', 'SSD_U2', 'SSD_E1S', 'SSD_E3S', 'SSD_PCIE_GEN5_AI'
)
AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.code = 'perfil_endurance'
);

-- Interface de armazenamento (SATA, SAS, NVMe) — complementa a subcategoria
INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, 'interface', 'Interface (SATA / SAS / NVMe)', 'text', false, 3
FROM categories c
WHERE c.code IN (
    'SSD_M2_NVME', 'SSD_SATA', 'SSD_SAS', 'SSD_U2', 'SSD_E1S', 'SSD_E3S', 'SSD_PCIE_GEN5_AI'
)
AND NOT EXISTS (
    SELECT 1 FROM category_attributes ca
    WHERE ca.category_id = c.id AND ca.code = 'interface'
);
