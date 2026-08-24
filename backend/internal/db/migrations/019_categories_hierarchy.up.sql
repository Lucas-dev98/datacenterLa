-- Hierarquia de categorias: Memória, SSD, HDD, GPU, Placa de rede, Fonte + subcategorias

INSERT INTO categories (id, code, name, parent_id, is_active)
VALUES ('55555555-5555-5555-5555-555555555001', 'MEMORIA', 'Memória', NULL, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = NULL,
    is_active = true;

INSERT INTO categories (code, name, parent_id, is_active) VALUES
    ('SSD', 'SSD', NULL, true),
    ('HDD', 'HDD', NULL, true),
    ('GPU', 'Placas gráficas', NULL, true),
    ('PLACA_REDE', 'Placa de rede', NULL, true),
    ('FONTE', 'Fonte', NULL, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = NULL,
    is_active = true;

-- Memória
INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('MEM_DDR4', 'Memória DDR4'),
    ('MEM_DDR5', 'Memória DDR5'),
    ('MEM_SERVIDOR', 'Memória de servidor'),
    ('MEM_NOTEBOOK', 'Memória de notebook'),
    ('MEM_ECC', 'Memória ECC / RDIMM')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'MEMORIA'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- SSD
INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('SSD_NVME', 'SSD NVMe'),
    ('SSD_SATA', 'SSD SATA'),
    ('SSD_ENTERPRISE', 'SSD Enterprise')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'SSD'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- HDD
INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('HDD_3_5', 'HDD 3.5"'),
    ('HDD_2_5', 'HDD 2.5"'),
    ('HDD_SAS', 'HDD SAS / Enterprise')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'HDD'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- Placas gráficas
INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('GPU_NVIDIA', 'NVIDIA'),
    ('GPU_AMD', 'AMD'),
    ('GPU_PROFISSIONAL', 'Profissional / Workstation')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'GPU'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- Placa de rede
INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('REDE_1G', 'Ethernet 1Gb'),
    ('REDE_10G', 'Ethernet 10Gb+'),
    ('REDE_FIBRA', 'Fibra / HBA'),
    ('REDE_WIFI', 'Wi-Fi')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'PLACA_REDE'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- Fonte
INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
    ('FONTE_ATX', 'Fonte ATX'),
    ('FONTE_SERVIDOR', 'Fonte de servidor'),
    ('FONTE_MODULAR', 'Fonte modular'),
    ('FONTE_REDUNDANTE', 'Fonte redundante')
) AS v(code, name)
CROSS JOIN categories p
WHERE p.code = 'FONTE'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    is_active = true;

-- Atributo capacidade nas subcategorias de memória
INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, 'capacidade', 'Capacidade', 'text', true, 1
FROM categories c
WHERE c.code IN ('MEM_DDR4', 'MEM_DDR5', 'MEM_SERVIDOR', 'MEM_NOTEBOOK', 'MEM_ECC')
  AND NOT EXISTS (
      SELECT 1 FROM category_attributes ca
      WHERE ca.category_id = c.id AND ca.code = 'capacidade'
  );

-- Atributo capacidade nos SSDs
INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, 'capacidade', 'Capacidade', 'text', true, 1
FROM categories c
WHERE c.code IN ('SSD_NVME', 'SSD_SATA', 'SSD_ENTERPRISE')
  AND NOT EXISTS (
      SELECT 1 FROM category_attributes ca
      WHERE ca.category_id = c.id AND ca.code = 'capacidade'
  );

-- Atributo capacidade nos HDDs
INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, 'capacidade', 'Capacidade', 'text', true, 1
FROM categories c
WHERE c.code IN ('HDD_3_5', 'HDD_2_5', 'HDD_SAS')
  AND NOT EXISTS (
      SELECT 1 FROM category_attributes ca
      WHERE ca.category_id = c.id AND ca.code = 'capacidade'
  );

-- Desativar categorias antigas / de teste fora do catálogo atual
UPDATE categories SET is_active = false
WHERE code IN (
    'SERVIDORES', 'STORAGE', 'REDES', 'PROCESSADORES', 'COMPONENTES',
    'ENERGIA', 'RACK', 'REFRIGERACAO', 'MEM-INT'
);

-- Produto seed → subcategoria Memória de servidor
UPDATE products SET category_id = (SELECT id FROM categories WHERE code = 'MEM_SERVIDOR')
WHERE id = '44444444-4444-4444-4444-444444444001';
