-- Entidades do grupo no exterior: nomes legais distintos, mesmo fluxo (exportação → Data Center LA PY)

UPDATE suppliers SET
    code = 'EXPORT-CN',
    name = 'Hailian Xinke Trading (Shenzhen) Co., Ltd.',
    legal_name = 'Hailian Xinke Trading (Shenzhen) Co., Ltd.',
    country = 'CN',
    kind = 'intercompany',
    holding_code = 'EXPORT-CN',
    notes = 'Empresa do grupo na China. Exporta mercadoria para Data Center LA (Paraguai). Entrada fiscal local registrada como compra intercompany.'
WHERE id = '77777777-7777-7777-7777-777777777001';

UPDATE suppliers SET
    code = 'EXPORT-US',
    name = 'Summit Bridge Technologies LLC',
    legal_name = 'Summit Bridge Technologies LLC',
    country = 'US',
    kind = 'intercompany',
    holding_code = 'EXPORT-US',
    notes = 'Empresa do grupo nos EUA. Exporta mercadoria para Data Center LA (Paraguai). Entrada fiscal local registrada como compra intercompany.'
WHERE id = '77777777-7777-7777-7777-777777777002';

-- Garante cadastro em ambientes que ainda não tinham os IDs fixos da 015
INSERT INTO suppliers (id, code, name, legal_name, country, kind, holding_code, notes)
VALUES
    ('77777777-7777-7777-7777-777777777001', 'EXPORT-CN',
     'Hailian Xinke Trading (Shenzhen) Co., Ltd.', 'Hailian Xinke Trading (Shenzhen) Co., Ltd.',
     'CN', 'intercompany', 'EXPORT-CN',
     'Empresa do grupo na China. Exporta mercadoria para Data Center LA (Paraguai). Entrada fiscal local registrada como compra intercompany.'),
    ('77777777-7777-7777-7777-777777777002', 'EXPORT-US',
     'Summit Bridge Technologies LLC', 'Summit Bridge Technologies LLC',
     'US', 'intercompany', 'EXPORT-US',
     'Empresa do grupo nos EUA. Exporta mercadoria para Data Center LA (Paraguai). Entrada fiscal local registrada como compra intercompany.')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    legal_name = EXCLUDED.legal_name,
    country = EXCLUDED.country,
    kind = EXCLUDED.kind,
    holding_code = EXCLUDED.holding_code,
    notes = EXCLUDED.notes;
