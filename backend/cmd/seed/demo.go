package main

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type seedIDs struct {
	Admin      uuid.UUID
	Seller     uuid.UUID
	Stock      uuid.UUID
	Warehouse  uuid.UUID
	LocDefault uuid.UUID
	LocA01     uuid.UUID
	LocA02     uuid.UUID
	LocA04     uuid.UUID
	LocB01     uuid.UUID
	LocB02     uuid.UUID
	LocRecv    uuid.UUID
	WalkIn     uuid.UUID
	Nucleo     uuid.UUID
	ExportCN   uuid.UUID
	ExportUS   uuid.UUID
	LocalPY    uuid.UUID
	POChina    uuid.UUID
	POUSA      uuid.UUID
}

func seedStaffAndWarehouse(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, hash string) error {
	if _, err := pool.Exec(ctx, `
		INSERT INTO warehouses (id, code, name) VALUES ($1, 'DEP01', 'Depósito Principal — Ciudad del Este')
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
	`, ids.Warehouse); err != nil {
		return err
	}

	locs := []struct {
		id                         uuid.UUID
		code, aisle, rack, sh, pos string
	}{
		{ids.LocDefault, "DEP01-A-03-02", "A", "03", "02", "01"},
		{ids.LocA01, "DEP01-A-01-01", "A", "01", "01", "01"},
		{ids.LocA02, "DEP01-A-02-01", "A", "02", "01", "01"},
		{ids.LocA04, "DEP01-A-04-01", "A", "04", "01", "01"},
		{ids.LocB01, "DEP01-B-01-01", "B", "01", "01", "01"},
		{ids.LocB02, "DEP01-B-02-01", "B", "02", "01", "01"},
		{ids.LocRecv, "DEP01-REC-01", "R", "01", "01", "01"},
	}
	for _, l := range locs {
		if _, err := pool.Exec(ctx, `
			INSERT INTO locations (id, warehouse_id, code, aisle, rack, shelf, position)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, l.id, ids.Warehouse, l.code, l.aisle, l.rack, l.sh, l.pos); err != nil {
			return err
		}
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
		VALUES ($1, 'admin@datacenterla.local', $2, 'Lucas Bastos', true, true)
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
	`, ids.Admin, hash); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		VALUES ($1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')
		ON CONFLICT DO NOTHING
	`, ids.Admin); err != nil {
		return err
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
		VALUES (
			'00000000-0000-0000-0000-000000000002',
			'shop.system@datacenterla.local',
			$1,
			'Loja e-commerce',
			true,
			true
		)
		ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, is_active = true
	`, hash); err != nil {
		return err
	}

	staff := []struct {
		id                uuid.UUID
		email, name, role string
	}{
		{ids.Seller, "ana.benitez@datacenterla.local", "Ana Benítez", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"},
		{ids.Stock, "rodrigo.ferreira@datacenterla.local", "Rodrigo Ferreira", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4"},
	}
	for _, u := range staff {
		if _, err := pool.Exec(ctx, `
			INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
			VALUES ($1, $2, $3, $4, true, true)
		`, u.id, u.email, hash, u.name); err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
		`, u.id, u.role); err != nil {
			return err
		}
	}
	return nil
}

func seedCustomers(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs) (map[string]uuid.UUID, error) {
	type cust struct {
		id, typ, name, email, phone, doc, residency, nationality, docType string
		credit                                                            float64
		terms                                                             int
		seller                                                            *uuid.UUID
	}
	seller := ids.Seller
	rows := []cust{
		{ids.WalkIn.String(), "b2c", "Consumidor final (balcão)", "", "", "", "", "", "", 0, 0, nil},
		{ids.Nucleo.String(), "b2b", "Núcleo Hosting S.A.", "compras@nucleohosting.com.py", "+595 21 498 2200", "80024567-3", "paraguayan", "PY", "ruc_pj", 80000, 30, &seller},
		{uuid.New().String(), "b2b", "Atlas Telecom Paraguay S.A.", "adquisiciones@atlastelecom.com.py", "+595 21 620 4400", "80019834-1", "paraguayan", "PY", "ruc_pj", 120000, 45, &seller},
		{uuid.New().String(), "b2b", "Red Guaraní Datacenter S.A.", "infra@redGuarani.com.py", "+595 61 500 180", "80031220-8", "paraguayan", "PY", "ruc_pj", 60000, 30, &seller},
		{uuid.New().String(), "b2b", "Paraná Cloud S.A.", "ops@paranacloud.com.py", "+595 61 574 900", "80045112-4", "paraguayan", "PY", "ruc_pj", 45000, 21, &seller},
		{uuid.New().String(), "b2b", "Grupo Itaipu Data S.A.", "ti@itaipudata.com.py", "+595 61 599 010", "80012009-6", "paraguayan", "PY", "ruc_pj", 150000, 45, &seller},
		{uuid.New().String(), "reseller", "TecnoMayorista del Este S.R.L.", "pedidos@tecnomayorista.com.py", "+595 61 510 770", "80056001-2", "paraguayan", "PY", "ruc_pj", 35000, 15, &seller},
		{uuid.New().String(), "b2b", "SurNet Soluciones S.R.L.", "contato@surnet.com.py", "+595 21 237 880", "80027890-5", "paraguayan", "PY", "ruc_pj", 25000, 21, nil},
		{uuid.New().String(), "b2c", "Diego Ramírez", "diego.ramirez@gmail.com", "+595 981 220 445", "4.812.903", "paraguayan", "PY", "ci_py", 0, 0, nil},
		{uuid.New().String(), "b2c", "Camila Ferreira", "camila.ferreira@outlook.com", "+55 45 99912-4408", "391.882.140-22", "foreigner", "BR", "cpf", 0, 0, nil},
		{uuid.New().String(), "b2c", "Martín López", "mlopez@personal.com.py", "+595 971 555 018", "3.904.221", "paraguayan", "PY", "ci_py", 0, 0, nil},
		{uuid.New().String(), "b2b", "Frontera IT Importadora S.A.", "compras@fronterait.com.py", "+595 61 508 330", "80040118-9", "paraguayan", "PY", "ruc_pj", 20000, 15, &seller},
	}
	byName := map[string]uuid.UUID{}
	for _, c := range rows {
		id := uuid.MustParse(c.id)
		var email, phone, doc, res, nat, dtype any
		if c.email != "" {
			email = c.email
		}
		if c.phone != "" {
			phone = c.phone
		}
		if c.doc != "" {
			doc = c.doc
		}
		if c.residency != "" {
			res = c.residency
		}
		if c.nationality != "" {
			nat = c.nationality
		}
		if c.docType != "" {
			dtype = c.docType
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO customers (id, type, name, email, phone, document_id, residency, nationality, document_type,
			                       credit_limit_usd, payment_terms_days, responsible_seller_id, is_active)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
		`, id, c.typ, c.name, email, phone, doc, res, nat, dtype, c.credit, c.terms, c.seller); err != nil {
			return nil, fmt.Errorf("customer %s: %w", c.name, err)
		}
		byName[c.name] = id
	}
	return byName, nil
}

func seedSuppliersAndPOs(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, skus map[string]catalogSKU) error {
	ids.ExportCN = uuid.MustParse("77777777-7777-7777-7777-777777777001")
	ids.ExportUS = uuid.MustParse("77777777-7777-7777-7777-777777777002")
	ids.LocalPY = uuid.New()
	mega := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO suppliers (id, code, name, legal_name, email, phone, document_id, country, kind, status)
		VALUES
			($1, 'TECNO-PY', 'TecnoImport Paraguay S.A.', 'TecnoImport Paraguay S.A.',
			 'ventas@tecnoimport.com.py', '+595 21 498 110', '80011022-7', 'PY', 'external', 'active'),
			($2, 'MEGA-PY', 'MegaParts CDE S.R.L.', 'MegaParts CDE S.R.L.',
			 'compras@megaparts.com.py', '+595 61 500 440', '80033019-1', 'PY', 'external', 'active')
	`, ids.LocalPY, mega); err != nil {
		return err
	}

	type poItem struct {
		code string
		qty  int
		recv int
	}
	type poSpec struct {
		id                                          uuid.UUID
		supplier                                    uuid.UUID
		status, origin, invoice, customs, incoterms string
		freight, duties                             float64
		country                                     string
		daysAgo                                     int
		notes                                       string
		items                                       []poItem
	}
	ids.POChina = uuid.New()
	ids.POUSA = uuid.New()
	pos := []poSpec{
		{
			id: ids.POChina, supplier: ids.ExportCN, status: "received", origin: "china",
			invoice: "HX-INV-2026-0841", customs: "DNA-CDE-26-11820", incoterms: "FOB",
			freight: 420, duties: 180, country: "CN", daysAgo: 28,
			notes: "Lote memória e SSD enterprise — Hailian Xinke Shenzhen.",
			items: []poItem{{"000001", 24, 24}, {"000002", 12, 12}, {"000006", 10, 10}, {"000007", 16, 16}, {"000012", 20, 20}},
		},
		{
			id: ids.POUSA, supplier: ids.ExportUS, status: "received", origin: "usa",
			invoice: "SB-INV-2026-331", customs: "DNA-CDE-26-11904", incoterms: "DAP",
			freight: 890, duties: 310, country: "US", daysAgo: 18,
			notes: "GPUs e placas de rede — Summit Bridge Miami.",
			items: []poItem{{"000016", 6, 6}, {"000017", 4, 4}, {"000018", 2, 2}, {"000020", 3, 3}, {"000021", 10, 10}, {"000022", 6, 6}},
		},
		{
			id: uuid.New(), supplier: ids.ExportCN, status: "ordered", origin: "china",
			invoice: "HX-INV-2026-0902", incoterms: "FOB", freight: 510, country: "CN", daysAgo: 6,
			notes: "Reposição HDD e SSD E3.S — ETA 12 dias.",
			items: []poItem{{"000010", 4, 0}, {"000013", 12, 0}, {"000014", 8, 0}},
		},
		{
			id: uuid.New(), supplier: ids.LocalPY, status: "ordered", origin: "local",
			incoterms: "EXW", country: "PY", daysAgo: 3,
			notes: "Fontes e NICs 1G para PDV — fornecedor local Asunción.",
			items: []poItem{{"000025", 12, 0}, {"000026", 8, 0}, {"000028", 4, 0}},
		},
		{
			id: uuid.New(), supplier: mega, status: "draft", origin: "local",
			country: "PY", daysAgo: 1,
			notes: "Cotação MegaParts — SODIMM e SSD SATA.",
			items: []poItem{{"000004", 20, 0}, {"000009", 8, 0}},
		},
		{
			id: uuid.New(), supplier: ids.ExportUS, status: "partial", origin: "usa",
			invoice: "SB-INV-2026-348", incoterms: "DAP", freight: 240, duties: 80, country: "US", daysAgo: 9,
			notes: "HBA FC e A6000 — recebimento parcial no pátio.",
			items: []poItem{{"000024", 4, 2}, {"000020", 2, 1}},
		},
	}

	for _, po := range pos {
		created := time.Now().AddDate(0, 0, -po.daysAgo)
		var ordered, received any
		if po.status != "draft" {
			t := created.Add(6 * time.Hour)
			ordered = t
		}
		if po.status == "received" {
			t := created.Add(72 * time.Hour)
			received = t
		}
		var number string
		if err := pool.QueryRow(ctx, `SELECT generate_po_number()`).Scan(&number); err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO purchase_orders (
				id, po_number, supplier_id, warehouse_id, status, expected_at, notes, created_by,
				ordered_at, received_at, created_at, import_origin, intercompany_invoice_ref,
				customs_declaration_ref, incoterms, freight_usd, duties_usd, origin_country_code
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
			)
		`, po.id, number, po.supplier, ids.Warehouse, po.status, created.AddDate(0, 0, 10),
			po.notes, ids.Admin, ordered, received, created, po.origin, nullIfEmpty(po.invoice),
			nullIfEmpty(po.customs), nullIfEmpty(po.incoterms), po.freight, po.duties, po.country); err != nil {
			return fmt.Errorf("po: %w", err)
		}
		total := po.freight + po.duties
		for _, it := range po.items {
			sku, ok := skus[it.code]
			if !ok {
				return fmt.Errorf("po sku %s não encontrado", it.code)
			}
			if _, err := pool.Exec(ctx, `
				INSERT INTO purchase_order_items (purchase_order_id, sku_id, quantity_ordered, quantity_received, unit_cost_usd)
				VALUES ($1,$2,$3,$4,$5)
			`, po.id, sku.ID, it.qty, it.recv, sku.Cost); err != nil {
				return err
			}
			total += sku.Cost * float64(it.qty)
		}
		if po.status == "received" || po.status == "partial" {
			status := "open"
			paid := 0.0
			if po.status == "received" && po.daysAgo > 20 {
				status = "paid"
				paid = total
			} else if po.status == "partial" {
				status = "partial"
				paid = total * 0.4
			}
			due := created.AddDate(0, 0, 20)
			if _, err := pool.Exec(ctx, `
				INSERT INTO accounts_payable (supplier_id, purchase_order_id, description, amount_usd, amount_paid_usd, due_date, status, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			`, po.supplier, po.id, "Importação "+number, total, paid, due, status, created); err != nil {
				return err
			}
		}
	}
	return nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

type stockPlan struct {
	Available, Received, Inspecting int
	PO                              uuid.UUID
	Loc                             uuid.UUID
}

func seedUnits(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, skus map[string]catalogSKU) error {
	plans := map[string]stockPlan{
		"000001": {Available: 14, Received: 4, Inspecting: 2, PO: ids.POChina, Loc: ids.LocDefault},
		"000002": {Available: 8, Received: 2, PO: ids.POChina, Loc: ids.LocA01},
		"000003": {Available: 6, Loc: ids.LocA01},
		"000004": {Available: 11, Loc: ids.LocA02},
		"000005": {Available: 3, Loc: ids.LocA01},
		"000006": {Available: 7, Received: 2, PO: ids.POChina, Loc: ids.LocB01},
		"000007": {Available: 9, PO: ids.POChina, Loc: ids.LocB01},
		"000008": {Available: 4, Loc: ids.LocB01},
		"000009": {Available: 6, Loc: ids.LocB02},
		"000010": {Available: 1, Received: 1, Loc: ids.LocB02}, // low stock
		"000011": {Available: 2, Loc: ids.LocB01},              // low stock
		"000012": {Available: 12, Received: 3, PO: ids.POChina, Loc: ids.LocA04},
		"000013": {Available: 8, Loc: ids.LocA04},
		"000014": {Available: 5, Loc: ids.LocA04},
		"000015": {Available: 4, Loc: ids.LocA04},
		"000016": {Available: 4, PO: ids.POUSA, Loc: ids.LocA02},
		"000017": {Available: 2, PO: ids.POUSA, Loc: ids.LocA02},               // low stock
		"000018": {Available: 1, Received: 1, PO: ids.POUSA, Loc: ids.LocRecv}, // crítico
		"000019": {Available: 2, Loc: ids.LocA02},
		"000020": {Available: 2, PO: ids.POUSA, Loc: ids.LocA02},
		"000021": {Available: 7, PO: ids.POUSA, Loc: ids.LocB02},
		"000022": {Available: 4, PO: ids.POUSA, Loc: ids.LocB02},
		"000023": {Available: 5, Loc: ids.LocB02},
		"000024": {Available: 3, Loc: ids.LocB02},
		"000025": {Available: 10, Loc: ids.LocDefault},
		"000026": {Available: 6, Loc: ids.LocDefault},
		"000027": {Available: 3, Loc: ids.LocDefault},
		"000028": {Available: 4, Loc: ids.LocDefault},
	}

	seq := 0
	insert := func(sku catalogSKU, status string, n int, loc, po uuid.UUID, receivedAgo int) error {
		for i := 0; i < n; i++ {
			seq++
			serial := fmt.Sprintf("%s-%04d", sku.Code, seq)
			if len(sku.Name) >= 3 {
				serial = fmt.Sprintf("%s-%s-%04d", sku.Code, sku.Name[:3], seq)
			}
			recvAt := time.Now().AddDate(0, 0, -receivedAgo).Add(-time.Duration(i) * time.Hour)
			var avail any
			var locID any
			if status == "available" {
				t := recvAt.Add(8 * time.Hour)
				avail = t
				locID = loc
			} else {
				locID = ids.LocRecv
			}
			var poID any
			if po != uuid.Nil {
				poID = po
			}
			if _, err := pool.Exec(ctx, `
				INSERT INTO inventory_units (
					public_code, sku_id, warehouse_id, location_id, status, purchase_id,
					unit_cost_usd, received_at, available_at, serial_number, created_at
				) VALUES (
					generate_unit_public_code(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $7
				)
			`, sku.ID, ids.Warehouse, locID, status, poID, sku.Cost, recvAt, avail, serial); err != nil {
				return err
			}
		}
		return nil
	}

	for code, sku := range skus {
		plan, ok := plans[code]
		if !ok {
			plan = stockPlan{Available: 6, Loc: ids.LocA02}
			if sku.Cost >= 3000 {
				plan.Available = 2
			} else if sku.Cost >= 800 {
				plan.Available = 4
			}
			if sku.Cost < 80 {
				plan.Available = 10
				plan.Received = 2
			}
		}
		if err := insert(sku, "available", plan.Available, plan.Loc, plan.PO, 20); err != nil {
			return err
		}
		if err := insert(sku, "received", plan.Received, ids.LocRecv, plan.PO, 1); err != nil {
			return err
		}
		if err := insert(sku, "inspecting", plan.Inspecting, ids.LocRecv, plan.PO, 2); err != nil {
			return err
		}
	}
	return nil
}

type lineSpec struct {
	Code string
	Qty  int
}

type orderSpec struct {
	Customer    uuid.UUID
	Seller      uuid.UUID
	Channel     string
	Status      string
	DaysAgo     int
	ShipDaysAgo int
	Notes       string
	Items       []lineSpec
	Credit      bool
	PaidPct     float64
	Method      string
	BuyerName   string
	BuyerRes    string
	BuyerNat    string
	BuyerDocT   string
	BuyerDoc    string
}

func seedQuotesOrders(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, skus map[string]catalogSKU, customers map[string]uuid.UUID) error {
	now := time.Now()
	nucleo := customers["Núcleo Hosting S.A."]
	atlas := customers["Atlas Telecom Paraguay S.A."]
	guarani := customers["Red Guaraní Datacenter S.A."]
	parana := customers["Paraná Cloud S.A."]
	itaipu := customers["Grupo Itaipu Data S.A."]
	mayor := customers["TecnoMayorista del Este S.R.L."]
	surnet := customers["SurNet Soluciones S.R.L."]
	diego := customers["Diego Ramírez"]
	camila := customers["Camila Ferreira"]
	martin := customers["Martín López"]
	frontera := customers["Frontera IT Importadora S.A."]

	type qspec struct {
		customer uuid.UUID
		status   string
		daysAgo  int
		notes    string
		items    []lineSpec
	}
	quotes := []qspec{
		{nucleo, "sent", 4, "Expansão de RAM nos hosts Proxmox — aguardando aprovação da diretoria.", []lineSpec{{"000002", 8}, {"000001", 16}}},
		{atlas, "negotiating", 6, "Cluster GPU para inferência. Pedido de desconto 8% no L40S.", []lineSpec{{"000018", 2}, {"000022", 4}}},
		{itaipu, "viewed", 2, "Storage nearline 18TB + HBA FC.", []lineSpec{{"000013", 12}, {"000024", 2}}},
		{parana, "approved", 1, "Aprovado comercialmente — converter em pedido esta semana.", []lineSpec{{"000006", 6}, {"000021", 4}}},
		{surnet, "draft", 0, "Rascunho interno — conferir estoque de SODIMM.", []lineSpec{{"000004", 10}}},
		{mayor, "sent", 8, "Reposição de prateleira: NICs 1G e fontes Corsair.", []lineSpec{{"000025", 8}, {"000026", 6}}},
	}
	for _, q := range quotes {
		created := now.AddDate(0, 0, -q.daysAgo)
		var number string
		if err := pool.QueryRow(ctx, `SELECT generate_quote_number()`).Scan(&number); err != nil {
			return err
		}
		var qid uuid.UUID
		valid := created.AddDate(0, 0, 10)
		var sent any
		if q.status != "draft" {
			t := created.Add(2 * time.Hour)
			sent = t
		}
		if err := pool.QueryRow(ctx, `
			INSERT INTO quotes (quote_number, customer_id, seller_id, status, channel, valid_until, notes, sent_at, created_at)
			VALUES ($1,$2,$3,$4,'erp',$5,$6,$7,$8)
			RETURNING id
		`, number, q.customer, ids.Seller, q.status, valid, q.notes, sent, created).Scan(&qid); err != nil {
			return err
		}
		for _, it := range q.items {
			sku := skus[it.Code]
			line := sku.B2B * float64(it.Qty)
			if _, err := pool.Exec(ctx, `
				INSERT INTO quote_items (quote_id, sku_id, quantity, unit_price_usd, line_total_usd)
				VALUES ($1,$2,$3,$4,$5)
			`, qid, sku.ID, it.Qty, sku.B2B, line); err != nil {
				return err
			}
		}
	}

	orders := []orderSpec{
		{Customer: nucleo, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 22, ShipDaysAgo: 18, Credit: true, PaidPct: 1,
			Notes: "Upgrade memória dual-socket — NF-e despachada para Asunción.",
			Items: []lineSpec{{"000001", 8}, {"000021", 2}}},
		{Customer: atlas, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 16, ShipDaysAgo: 12, Credit: true, PaidPct: 0.5,
			Notes: "Primeiro lote GPU A4000 para NOC.",
			Items: []lineSpec{{"000016", 2}, {"000007", 4}}},
		{Customer: guarani, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 10, ShipDaysAgo: 7, Credit: true, PaidPct: 0,
			Notes: "Storage 16TB + SSD U.2 para Ceph.",
			Items: []lineSpec{{"000012", 6}, {"000006", 2}}},
		{Customer: itaipu, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 8, ShipDaysAgo: 5, Credit: true, PaidPct: 1,
			Notes: "Workstations de engenharia — A6000.",
			Items: []lineSpec{{"000020", 1}, {"000028", 1}}},
		{Customer: parana, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 5, ShipDaysAgo: 3, Credit: true, PaidPct: 0,
			Notes: "NICs 25G para spine do DC.",
			Items: []lineSpec{{"000022", 2}, {"000025", 2}}},
		{Customer: mayor, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 4, ShipDaysAgo: 2, Method: "transfer",
			Notes: "Pedido atacado — pronta entrega CDE.",
			Items: []lineSpec{{"000004", 4}, {"000026", 2}}},
		{Customer: frontera, Seller: ids.Seller, Channel: "erp", Status: "shipped", DaysAgo: 36, ShipDaysAgo: 32, Credit: true, PaidPct: 1,
			Notes: "Lote HDD SAS julho.",
			Items: []lineSpec{{"000014", 3}}},
		{Customer: diego, Seller: ids.Seller, Channel: "store", Status: "shipped", DaysAgo: 2, ShipDaysAgo: 2, Method: "cash",
			Notes:     "Venda balcão — SSD 990 PRO.",
			Items:     []lineSpec{{"000007", 1}},
			BuyerName: "Diego Ramírez", BuyerRes: "paraguayan", BuyerNat: "PY", BuyerDocT: "ci_py", BuyerDoc: "4.812.903"},
		{Customer: camila, Seller: ids.Seller, Channel: "store", Status: "shipped", DaysAgo: 1, ShipDaysAgo: 1, Method: "pix",
			Notes:     "PDV — cliente brasileira, CPF.",
			Items:     []lineSpec{{"000026", 1}},
			BuyerName: "Camila Ferreira", BuyerRes: "foreigner", BuyerNat: "BR", BuyerDocT: "cpf", BuyerDoc: "391.882.140-22"},
		{Customer: martin, Seller: ids.Seller, Channel: "ecommerce", Status: "shipped", DaysAgo: 6, ShipDaysAgo: 4, Method: "card",
			Notes: "Pedido loja online — SODIMM notebook.",
			Items: []lineSpec{{"000004", 2}}},
		{Customer: ids.WalkIn, Seller: ids.Seller, Channel: "store", Status: "shipped", DaysAgo: 3, ShipDaysAgo: 3, Method: "cash",
			Notes: "Consumidor final — NIC I350.",
			Items: []lineSpec{{"000025", 1}}},
		{Customer: nucleo, Seller: ids.Seller, Channel: "erp", Status: "paid", DaysAgo: 2, Method: "transfer",
			Notes: "Pedido confirmado e pago — aguardando separação.",
			Items: []lineSpec{{"000002", 4}, {"000009", 2}}},
		{Customer: atlas, Seller: ids.Seller, Channel: "erp", Status: "picking", DaysAgo: 1,
			Notes: "Em separação no corredor A.",
			Items: []lineSpec{{"000016", 1}, {"000021", 1}}},
		{Customer: guarani, Seller: ids.Seller, Channel: "erp", Status: "confirmed", DaysAgo: 1, Credit: true,
			Notes: "Crédito 30 dias — confirmar picking amanhã.",
			Items: []lineSpec{{"000013", 4}}},
		{Customer: parana, Seller: ids.Seller, Channel: "erp", Status: "confirmed", DaysAgo: 0,
			Notes: "Pedido de reposição SSD SATA.",
			Items: []lineSpec{{"000009", 2}}},
		{Customer: surnet, Seller: ids.Seller, Channel: "erp", Status: "draft", DaysAgo: 0,
			Notes: "Rascunho — validar crédito com financeiro.",
			Items: []lineSpec{{"000023", 2}}},
		{Customer: itaipu, Seller: ids.Seller, Channel: "erp", Status: "cancelled", DaysAgo: 9,
			Notes: "Cancelado — cliente optou por L40S no lugar da A6000.",
			Items: []lineSpec{{"000020", 1}}},
		{Customer: camila, Seller: ids.Seller, Channel: "ecommerce", Status: "paid", DaysAgo: 0, Method: "card",
			Notes: "Checkout loja — RTX 4090, pagamento aprovado.",
			Items: []lineSpec{{"000017", 1}}},
		{Customer: mayor, Seller: ids.Seller, Channel: "erp", Status: "picking", DaysAgo: 0,
			Notes: "Separação atacado — fontes e NICs.",
			Items: []lineSpec{{"000027", 2}, {"000025", 3}}},
	}

	var shippedForRMA, shippedForReturn uuid.UUID
	var rmaItem, returnItem uuid.UUID
	var rmaSKU, returnSKU uuid.UUID

	for i, spec := range orders {
		oid, itemIDs, err := insertOrder(ctx, pool, ids, skus, spec, now)
		if err != nil {
			return fmt.Errorf("order %d: %w", i, err)
		}
		if spec.ShipDaysAgo == 12 && spec.Customer == atlas {
			shippedForRMA = oid
			rmaItem = itemIDs[0]
			rmaSKU = skus[spec.Items[0].Code].ID
		}
		if spec.ShipDaysAgo == 2 && spec.Customer == diego {
			shippedForReturn = oid
			returnItem = itemIDs[0]
			returnSKU = skus[spec.Items[0].Code].ID
		}
	}

	if shippedForRMA != uuid.Nil {
		var caseID uuid.UUID
		var num string
		if err := pool.QueryRow(ctx, `SELECT generate_rma_case_number()`).Scan(&num); err != nil {
			return err
		}
		created := now.AddDate(0, 0, -4)
		if err := pool.QueryRow(ctx, `
			INSERT INTO rma_cases (case_number, order_id, customer_id, status, reason, notes, requested_by, created_at, updated_at)
			VALUES ($1,$2,$3,'inspecting',$4,$5,$6,$7,$7)
			RETURNING id
		`, num, shippedForRMA, atlas,
			"GPU A4000 com artefatos na tela após 10 dias de uso em render 24/7.",
			"Unidade recolhida no NOC Atlas. Teste de burn-in em andamento no laboratório.",
			ids.Seller, created,
		).Scan(&caseID); err != nil {
			return err
		}
		var unitID uuid.UUID
		_ = pool.QueryRow(ctx, `
			SELECT id FROM inventory_units WHERE order_item_id = $1 AND status = 'sold' LIMIT 1
		`, rmaItem).Scan(&unitID)
		if _, err := pool.Exec(ctx, `
			INSERT INTO rma_items (rma_case_id, order_item_id, sku_id, inventory_unit_id, quantity, condition_notes)
			VALUES ($1,$2,$3,$4,1,'Marcas de uso, sem dano físico visível no PCB.')
		`, caseID, rmaItem, rmaSKU, nullUUID(unitID)); err != nil {
			return err
		}

		var num2 string
		if err := pool.QueryRow(ctx, `SELECT generate_rma_case_number()`).Scan(&num2); err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO rma_cases (case_number, order_id, customer_id, status, reason, resolution, notes, requested_by, approved_by, created_at)
			VALUES ($1,$2,$3,'approved',$4,'replace',$5,$6,$7,$8)
		`, num2, shippedForRMA, atlas,
			"Solicitação de troca preventiva do segundo A4000 do mesmo lote.",
			"Aprovado comercialmente. Aguardando chegada da unidade substituta.",
			ids.Seller, ids.Admin, now.AddDate(0, 0, -1)); err != nil {
			return err
		}
	}

	if shippedForReturn != uuid.Nil {
		var rid uuid.UUID
		var num string
		if err := pool.QueryRow(ctx, `SELECT generate_customer_return_number()`).Scan(&num); err != nil {
			return err
		}
		if err := pool.QueryRow(ctx, `
			INSERT INTO customer_returns (return_number, order_id, customer_id, status, reason, condition_notes, requested_by, created_at)
			VALUES ($1,$2,$3,'requested',$4,$5,$6,$7)
			RETURNING id
		`, num, shippedForReturn, diego,
			"Cliente desistiu — SSD incompatível com o notebook antigo (sem NVMe).",
			"Caixa aberta, lacre do blister intacto.",
			ids.Seller, now.Add(-8*time.Hour),
		).Scan(&rid); err != nil {
			return err
		}
		var unitID uuid.UUID
		_ = pool.QueryRow(ctx, `
			SELECT id FROM inventory_units WHERE order_item_id = $1 AND status = 'sold' LIMIT 1
		`, returnItem).Scan(&unitID)
		if _, err := pool.Exec(ctx, `
			INSERT INTO customer_return_items (return_id, order_item_id, sku_id, inventory_unit_id, quantity, condition_notes)
			VALUES ($1,$2,$3,$4,1,'Em perfeito estado, embalagem original.')
		`, rid, returnItem, returnSKU, nullUUID(unitID)); err != nil {
			return err
		}
	}
	return nil
}

func nullUUID(id uuid.UUID) any {
	if id == uuid.Nil {
		return nil
	}
	return id
}

func insertOrder(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, skus map[string]catalogSKU, spec orderSpec, now time.Time) (uuid.UUID, []uuid.UUID, error) {
	created := now.AddDate(0, 0, -spec.DaysAgo)
	var number string
	if err := pool.QueryRow(ctx, `SELECT generate_order_number()`).Scan(&number); err != nil {
		return uuid.Nil, nil, err
	}
	subtotal := 0.0
	type priced struct {
		sku   catalogSKU
		qty   int
		price float64
		line  float64
	}
	var lines []priced
	for _, it := range spec.Items {
		sku, ok := skus[it.Code]
		if !ok {
			return uuid.Nil, nil, fmt.Errorf("sku %s", it.Code)
		}
		price := sku.B2B
		switch spec.Channel {
		case "store", "ecommerce":
			price = sku.B2C
		}
		line := price * float64(it.Qty)
		subtotal += line
		lines = append(lines, priced{sku, it.Qty, price, line})
	}

	var confirmed, paid, shipped, cancelled any
	if spec.Status != "draft" && spec.Status != "cancelled" {
		t := created.Add(2 * time.Hour)
		confirmed = t
	}
	if spec.Status == "paid" || spec.Status == "picking" || spec.Status == "shipped" {
		t := created.Add(5 * time.Hour)
		paid = t
	}
	if spec.Status == "shipped" {
		t := now.AddDate(0, 0, -spec.ShipDaysAgo)
		shipped = t
	}
	if spec.Status == "cancelled" {
		t := created.Add(24 * time.Hour)
		cancelled = t
	}

	var oid uuid.UUID
	if err := pool.QueryRow(ctx, `
		INSERT INTO orders (
			order_number, customer_id, seller_id, channel, status, warehouse_id,
			subtotal_usd, total_usd, notes, confirmed_at, paid_at, shipped_at, cancelled_at, created_at,
			buyer_name, buyer_residency, buyer_nationality, buyer_document_type, buyer_document_id
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
		) RETURNING id
	`, number, spec.Customer, spec.Seller, spec.Channel, spec.Status, ids.Warehouse,
		subtotal, spec.Notes, confirmed, paid, shipped, cancelled, created,
		nullIfEmpty(spec.BuyerName), nullIfEmpty(spec.BuyerRes), nullIfEmpty(spec.BuyerNat),
		nullIfEmpty(spec.BuyerDocT), nullIfEmpty(spec.BuyerDoc),
	).Scan(&oid); err != nil {
		return uuid.Nil, nil, err
	}

	itemIDs := make([]uuid.UUID, 0, len(lines))
	for _, ln := range lines {
		var iid uuid.UUID
		if err := pool.QueryRow(ctx, `
			INSERT INTO order_items (order_id, sku_id, quantity, unit_price_usd, line_total_usd)
			VALUES ($1,$2,$3,$4,$5) RETURNING id
		`, oid, ln.sku.ID, ln.qty, ln.price, ln.line).Scan(&iid); err != nil {
			return uuid.Nil, nil, err
		}
		itemIDs = append(itemIDs, iid)

		unitStatus := ""
		switch spec.Status {
		case "shipped":
			unitStatus = "sold"
		case "picking":
			unitStatus = "picking"
		case "paid", "confirmed":
			unitStatus = "reserved"
		}
		if unitStatus != "" {
			if err := allocateUnits(ctx, pool, ids, oid, iid, ln.sku.ID, ln.qty, unitStatus, shipped); err != nil {
				return uuid.Nil, nil, err
			}
		}
	}

	if spec.Status == "shipped" || spec.Status == "paid" || spec.Status == "picking" {
		if spec.Credit {
			due := created.AddDate(0, 0, 30)
			paidAmt := subtotal * spec.PaidPct
			st := "open"
			if spec.PaidPct >= 1 {
				st = "paid"
			} else if spec.PaidPct > 0 {
				st = "partial"
			}
			if _, err := pool.Exec(ctx, `
				INSERT INTO accounts_receivable (order_id, customer_id, amount_usd, paid_usd, due_date, status, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7)
			`, oid, spec.Customer, subtotal, paidAmt, due, st, created); err != nil {
				return uuid.Nil, nil, err
			}
			if paidAmt > 0 {
				method := spec.Method
				if method == "" {
					method = "transfer"
				}
				if _, err := pool.Exec(ctx, `
					INSERT INTO payments (order_id, amount_usd, method, status, recorded_by, completed_at, created_at)
					VALUES ($1,$2,$3,'completed',$4,$5,$5)
				`, oid, paidAmt, method, ids.Seller, paid); err != nil {
					return uuid.Nil, nil, err
				}
			}
		} else if spec.Method != "" && spec.Status != "confirmed" {
			if _, err := pool.Exec(ctx, `
				INSERT INTO payments (order_id, amount_usd, method, status, recorded_by, completed_at, created_at)
				VALUES ($1,$2,$3,'completed',$4,$5,$5)
			`, oid, subtotal, spec.Method, ids.Seller, paid); err != nil {
				return uuid.Nil, nil, err
			}
		}
	}
	return oid, itemIDs, nil
}

func allocateUnits(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, orderID, itemID, skuID uuid.UUID, qty int, status string, shippedAt any) error {
	rows, err := pool.Query(ctx, `
		SELECT id FROM inventory_units
		WHERE sku_id = $1 AND warehouse_id = $2 AND status = 'available'
		ORDER BY created_at
		LIMIT $3
		FOR UPDATE
	`, skuID, ids.Warehouse, qty)
	if err != nil {
		return err
	}
	var idsFound []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		idsFound = append(idsFound, id)
	}
	rows.Close()
	if len(idsFound) < qty {
		return fmt.Errorf("estoque insuficiente sku %s: need %d have %d", skuID, qty, len(idsFound))
	}
	for _, uid := range idsFound {
		var soldAt any
		if status == "sold" {
			soldAt = shippedAt
		}
		if _, err := pool.Exec(ctx, `
			UPDATE inventory_units
			SET status = $2, order_id = $3, order_item_id = $4, sold_at = $5, updated_at = now(), version = version + 1
			WHERE id = $1
		`, uid, status, orderID, itemID, soldAt); err != nil {
			return err
		}
		if status == "reserved" || status == "picking" {
			if _, err := pool.Exec(ctx, `
				INSERT INTO stock_reservations (
					order_id, order_item_id, sku_id, warehouse_id, inventory_unit_id, quantity, status, expires_at
				) VALUES ($1,$2,$3,$4,$5,1,'active', now() + interval '7 days')
			`, orderID, itemID, skuID, ids.Warehouse, uid); err != nil {
				return err
			}
		}
		if status == "sold" {
			if _, err := pool.Exec(ctx, `
				INSERT INTO stock_reservations (
					order_id, order_item_id, sku_id, warehouse_id, inventory_unit_id, quantity, status, expires_at, fulfilled_at
				) VALUES ($1,$2,$3,$4,$5,1,'fulfilled', now() + interval '7 days', $6)
			`, orderID, itemID, skuID, ids.Warehouse, uid, shippedAt); err != nil {
				return err
			}
		}
	}
	return nil
}

func seedLeadsAndOps(ctx context.Context, pool *pgxpool.Pool, ids *seedIDs, skus map[string]catalogSKU, customers map[string]uuid.UUID) error {
	leads := []struct {
		name, email, phone, company, source, status, notes string
	}{
		{"Héctor Villalba", "hector@copacopartner.com.py", "+595 21 210 400", "Copaco Partner", "web", "qualified", "Quer 8x L40S para PoC de IA no segundo semestre."},
		{"Juliana Costa", "juliana@hospitalcde.com.py", "+595 61 507 200", "Hospital CDE", "referral", "contacted", "Storage para PACS — 18TB NL-SAS."},
		{"Rafael Mendes", "rmendes@itau.com.py", "+595 21 618 000", "Banco regional", "event", "new", "Contato na Expo IT Asunción."},
		{"Sofía Duarte", "sofia@universidad.edu.py", "+595 21 585 600", "Universidad Católica", "web", "converted", "Convertido em Núcleo Hosting (projeto irmão)."},
		{"Paulo Henrique", "ph@datacentersp.com.br", "+55 11 98800-1122", "DC São Paulo", "web", "lost", "Perdemos para concorrente em Campinas — preço."},
		{"Leticia Gómez", "lgomez@anatel.py", "+595 21 400 100", "Projeto governo", "other", "new", "Licitação de switches — ainda sem NIC no escopo."},
	}
	for i, l := range leads {
		var cust any
		if l.status == "converted" {
			cust = customers["Núcleo Hosting S.A."]
		}
		created := time.Now().AddDate(0, 0, -(12 - i))
		if _, err := pool.Exec(ctx, `
			INSERT INTO crm_leads (name, email, phone, company, source, status, notes, owner_id, customer_id, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, l.name, l.email, l.phone, l.company, l.source, l.status, l.notes, ids.Seller, cust, created); err != nil {
			return err
		}
	}

	var countID uuid.UUID
	if err := pool.QueryRow(ctx, `
		INSERT INTO stock_counts (warehouse_id, count_type, status, started_at, created_by)
		VALUES ($1, 'cyclic', 'in_progress', now() - interval '3 hours', $2)
		RETURNING id
	`, ids.Warehouse, ids.Stock).Scan(&countID); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO stock_count_lines (stock_count_id, inventory_unit_id, sku_id, location_id, system_qty, counted_qty, status)
		SELECT $1, u.id, u.sku_id, u.location_id, 1,
		       CASE WHEN row_number() OVER (ORDER BY u.public_code) <= 2 THEN 0 ELSE 1 END,
		       CASE WHEN row_number() OVER (ORDER BY u.public_code) <= 2 THEN 'variance' ELSE 'counted' END
		FROM inventory_units u
		WHERE u.status = 'available' AND u.warehouse_id = $2
		ORDER BY u.public_code
		LIMIT 12
	`, countID, ids.Warehouse); err != nil {
		return err
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO stock_balances (sku_id, warehouse_id, qty_physical, qty_reserved)
		SELECT sku_id, warehouse_id,
			COUNT(*) FILTER (WHERE status IN (
				'received','inspecting','identified','available','reserved','picking','blocked','damaged','warranty','rma','returned'
			)),
			COUNT(*) FILTER (WHERE status IN ('reserved','picking'))
		FROM inventory_units
		GROUP BY sku_id, warehouse_id
	`); err != nil {
		return err
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO stock_movements (
			movement_type, sku_id, warehouse_id, inventory_unit_id, quantity,
			unit_status_after, reference_type, reference_id, created_by, created_at
		)
		SELECT 'purchase_in', sku_id, warehouse_id, id, 1, 'received', 'purchase_order', purchase_id, $1, received_at
		FROM inventory_units
		WHERE received_at IS NOT NULL
	`, ids.Stock); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO stock_movements (
			movement_type, sku_id, warehouse_id, inventory_unit_id, quantity,
			unit_status_before, unit_status_after, reference_type, created_by, created_at
		)
		SELECT 'status_change', sku_id, warehouse_id, id, 1, 'received', 'available', 'intake', $1, available_at
		FROM inventory_units
		WHERE available_at IS NOT NULL
	`, ids.Stock); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO stock_movements (
			movement_type, sku_id, warehouse_id, inventory_unit_id, quantity,
			unit_status_before, unit_status_after, reference_type, reference_id, created_by, created_at
		)
		SELECT 'sale_out', sku_id, warehouse_id, id, 1, 'available', 'sold', 'order', order_id, $1, COALESCE(sold_at, updated_at)
		FROM inventory_units
		WHERE status = 'sold'
	`, ids.Seller); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO stock_movements (
			movement_type, sku_id, warehouse_id, inventory_unit_id, quantity,
			unit_status_before, unit_status_after, reference_type, reference_id, created_by, created_at
		)
		SELECT 'reserve', sku_id, warehouse_id, id, 1, 'available', status, 'order', order_id, $1, updated_at
		FROM inventory_units
		WHERE status IN ('reserved','picking')
	`, ids.Seller); err != nil {
		return err
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO feed_sync_logs (channel, status, item_count, skipped_count, content_hash, duration_ms, trigger_source, created_at)
		VALUES
			('compras_paraguai', 'success', 22, 3, 'demo-hash-001', 41, 'scheduled', now() - interval '2 hours'),
			('compras_paraguai', 'success', 22, 3, 'demo-hash-002', 38, 'manual', now() - interval '1 day')
	`); err != nil {
		return err
	}

	_ = skus
	return nil
}
