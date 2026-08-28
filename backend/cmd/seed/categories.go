package main

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func seedCategories(ctx context.Context, pool *pgxpool.Pool) error {
	parents := []struct{ code, name string }{
		{"MEMORIA", "Memória"},
		{"SSD", "SSD"},
		{"HDD", "HDD"},
		{"GPU", "Placas gráficas"},
		{"PLACA_REDE", "Placa de rede"},
		{"FONTE", "Fonte"},
		{"PROCESSADOR", "Processador"},
		{"SERVIDOR", "Servidor"},
		{"STORAGE", "Storage"},
		{"SWITCH", "Switch"},
	}
	for _, c := range parents {
		if _, err := pool.Exec(ctx, `
			INSERT INTO categories (code, name)
			VALUES ($1::varchar, $2::varchar)
			ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true, parent_id = NULL
		`, c.code, c.name); err != nil {
			return err
		}
	}

	children := []struct{ parent, code, name string }{
		{"PROCESSADOR", "CPU_INTEL", "Intel Xeon"},
		{"PROCESSADOR", "CPU_AMD", "AMD EPYC"},
		{"SERVIDOR", "SRV_RACK_1U", "Servidor 1U"},
		{"SERVIDOR", "SRV_RACK_2U", "Servidor 2U"},
		{"SERVIDOR", "SRV_TOWER", "Servidor torre / workstation"},
		{"STORAGE", "STG_NAS", "NAS"},
		{"STORAGE", "STG_SAN", "SAN"},
		{"STORAGE", "STG_DAS", "DAS / JBOD"},
		{"SWITCH", "SW_ACCESS", "Switch de acesso"},
		{"SWITCH", "SW_DATACENTER", "Switch datacenter"},
	}
	for _, c := range children {
		if _, err := pool.Exec(ctx, `
			INSERT INTO categories (code, name, parent_id, is_active)
			SELECT $2::varchar, $3::varchar, p.id, true FROM categories p WHERE p.code = $1::varchar
			ON CONFLICT (code) DO UPDATE SET
				name = EXCLUDED.name,
				parent_id = EXCLUDED.parent_id,
				is_active = true
		`, c.parent, c.code, c.name); err != nil {
			return err
		}
	}

	type attr struct {
		cats       []string
		code, name string
		required   bool
		order      int
	}
	attrs := []attr{
		{[]string{"CPU_INTEL", "CPU_AMD"}, "socket", "Socket", true, 1},
		{[]string{"CPU_INTEL", "CPU_AMD"}, "nucleos", "Núcleos / threads", true, 2},
		{[]string{"CPU_INTEL", "CPU_AMD"}, "frequencia", "Frequência", false, 3},
		{[]string{"SRV_RACK_1U", "SRV_RACK_2U", "SRV_TOWER"}, "form_factor", "Form factor", true, 1},
		{[]string{"SRV_RACK_1U", "SRV_RACK_2U", "SRV_TOWER"}, "socket", "Socket / plataforma", true, 2},
		{[]string{"STG_NAS", "STG_SAN", "STG_DAS"}, "form_factor", "Form factor", true, 1},
		{[]string{"STG_NAS", "STG_SAN", "STG_DAS"}, "baias", "Baias / capacidade", true, 2},
		{[]string{"STG_NAS", "STG_SAN", "STG_DAS"}, "protocolo", "Protocolo / interface", true, 3},
		{[]string{"SW_ACCESS", "SW_DATACENTER"}, "form_factor", "Form factor", true, 1},
		{[]string{"SW_ACCESS", "SW_DATACENTER"}, "portas", "Portas", true, 2},
		{[]string{"SW_ACCESS", "SW_DATACENTER"}, "velocidade", "Velocidade", true, 3},
	}
	for _, a := range attrs {
		for _, cat := range a.cats {
			if _, err := pool.Exec(ctx, `
				INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
				SELECT c.id, $2::varchar, $3::varchar, 'text', $4::boolean, $5::int
				FROM categories c
				WHERE c.code = $1::varchar
				  AND NOT EXISTS (
				      SELECT 1 FROM category_attributes ca
				      WHERE ca.category_id = c.id AND ca.code = $2::varchar
				  )
			`, cat, a.code, a.name, a.required, a.order); err != nil {
				return err
			}
		}
	}
	return nil
}
