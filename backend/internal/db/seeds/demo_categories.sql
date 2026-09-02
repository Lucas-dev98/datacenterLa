-- PIM category tree for the demo catalog (~99 SKUs).
INSERT INTO categories (code, name)
VALUES
	('MEMORIA', 'Memória'),
	('SSD', 'SSD'),
	('HDD', 'HDD'),
	('GPU', 'Placas gráficas'),
	('PLACA_REDE', 'Placa de rede'),
	('FONTE', 'Fonte'),
	('PROCESSADOR', 'Processador'),
	('SERVIDOR', 'Servidor'),
	('STORAGE', 'Storage'),
	('SWITCH', 'Switch')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true, parent_id = NULL;

INSERT INTO categories (code, name, parent_id, is_active)
SELECT v.code, v.name, p.id, true
FROM (VALUES
	('PROCESSADOR', 'CPU_INTEL', 'Intel Xeon'),
	('PROCESSADOR', 'CPU_AMD', 'AMD EPYC'),
	('SERVIDOR', 'SRV_RACK_1U', 'Servidor 1U'),
	('SERVIDOR', 'SRV_RACK_2U', 'Servidor 2U'),
	('SERVIDOR', 'SRV_TOWER', 'Servidor torre / workstation'),
	('STORAGE', 'STG_NAS', 'NAS'),
	('STORAGE', 'STG_SAN', 'SAN'),
	('STORAGE', 'STG_DAS', 'DAS / JBOD'),
	('SWITCH', 'SW_ACCESS', 'Switch de acesso'),
	('SWITCH', 'SW_DATACENTER', 'Switch datacenter')
) AS v(parent_code, code, name)
JOIN categories p ON p.code = v.parent_code
ON CONFLICT (code) DO UPDATE SET
	name = EXCLUDED.name,
	parent_id = EXCLUDED.parent_id,
	is_active = true;

INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
SELECT c.id, v.attr_code, v.attr_name, 'text', v.required, v.sort_order
FROM (VALUES
	('CPU_INTEL', 'socket', 'Socket', true, 1),
	('CPU_INTEL', 'nucleos', 'Núcleos / threads', true, 2),
	('CPU_INTEL', 'frequencia', 'Frequência', false, 3),
	('CPU_AMD', 'socket', 'Socket', true, 1),
	('CPU_AMD', 'nucleos', 'Núcleos / threads', true, 2),
	('CPU_AMD', 'frequencia', 'Frequência', false, 3),
	('SRV_RACK_1U', 'form_factor', 'Form factor', true, 1),
	('SRV_RACK_1U', 'socket', 'Socket / plataforma', true, 2),
	('SRV_RACK_2U', 'form_factor', 'Form factor', true, 1),
	('SRV_RACK_2U', 'socket', 'Socket / plataforma', true, 2),
	('SRV_TOWER', 'form_factor', 'Form factor', true, 1),
	('SRV_TOWER', 'socket', 'Socket / plataforma', true, 2),
	('STG_NAS', 'form_factor', 'Form factor', true, 1),
	('STG_NAS', 'baias', 'Baias / capacidade', true, 2),
	('STG_NAS', 'protocolo', 'Protocolo / interface', true, 3),
	('STG_SAN', 'form_factor', 'Form factor', true, 1),
	('STG_SAN', 'baias', 'Baias / capacidade', true, 2),
	('STG_SAN', 'protocolo', 'Protocolo / interface', true, 3),
	('STG_DAS', 'form_factor', 'Form factor', true, 1),
	('STG_DAS', 'baias', 'Baias / capacidade', true, 2),
	('STG_DAS', 'protocolo', 'Protocolo / interface', true, 3),
	('SW_ACCESS', 'form_factor', 'Form factor', true, 1),
	('SW_ACCESS', 'portas', 'Portas', true, 2),
	('SW_ACCESS', 'velocidade', 'Velocidade', true, 3),
	('SW_DATACENTER', 'form_factor', 'Form factor', true, 1),
	('SW_DATACENTER', 'portas', 'Portas', true, 2),
	('SW_DATACENTER', 'velocidade', 'Velocidade', true, 3)
) AS v(cat_code, attr_code, attr_name, required, sort_order)
JOIN categories c ON c.code = v.cat_code
WHERE NOT EXISTS (
	SELECT 1 FROM category_attributes ca
	WHERE ca.category_id = c.id AND ca.code = v.attr_code
);
