package main

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type catalogSKU struct {
	ID       uuid.UUID
	Code     string
	Name     string
	Cost     float64
	Min      float64
	B2C      float64
	B2B      float64
	Reseller float64
}

type catalogItem struct {
	Category       string
	Brand          string
	Manufacturer   string
	Name           string
	NameES         string
	Description    string
	DescriptionES  string
	SKUName        string
	Cost, Min      float64
	B2C, B2B, Res  float64
	PublishCP      bool
	PublishEcom    bool
	Attrs          map[string]string
	FixedProductID uuid.UUID
	FixedSKUID     uuid.UUID
	FixedCode      string
}

func catalogItems() []catalogItem {
	items := []catalogItem{
		{
			Category: "MEM_SERVIDOR", Brand: "Samsung", Manufacturer: "Samsung",
			Name: "Memória Samsung 32GB DDR4-3200 ECC RDIMM",
			NameES: "Memoria Samsung 32GB DDR4-3200 ECC RDIMM",
			Description: "Módulo RDIMM ECC Samsung 32GB DDR4-3200 para servidores dual-processor. Ideal para virtualização e bancos de dados.",
			DescriptionES: "Módulo RDIMM ECC Samsung 32GB DDR4-3200 para servidores dual-processor. Ideal para virtualización y bases de datos.",
			SKUName: "Samsung 32GB DDR4-3200 ECC RDIMM",
			Cost: 120, Min: 150, B2C: 199.99, B2B: 179.99, Res: 169.99,
			PublishCP: true, PublishEcom: true,
			Attrs:          map[string]string{"capacidade": "32 GB"},
			FixedProductID: uuid.MustParse("44444444-4444-4444-4444-444444444001"),
			FixedSKUID:     uuid.MustParse("33333333-3333-3333-3333-333333333001"),
			FixedCode:      "000001",
		},
		{
			Category: "MEM_SERVIDOR", Brand: "Samsung", Manufacturer: "Samsung",
			Name: "Memória Samsung 64GB DDR4-3200 ECC RDIMM",
			NameES: "Memoria Samsung 64GB DDR4-3200 ECC RDIMM",
			Description: "RDIMM ECC 64GB Samsung para expansão de memória em hosts de virtualização e HPC.",
			DescriptionES: "RDIMM ECC 64GB Samsung para expansión de memoria en hosts de virtualización y HPC.",
			SKUName: "Samsung 64GB DDR4-3200 ECC RDIMM",
			Cost: 210, Min: 260, B2C: 349, B2B: 319, Res: 299,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "64 GB"},
		},
		{
			Category: "MEM_ECC", Brand: "Micron", Manufacturer: "Micron",
			Name: "Memória Micron 32GB DDR5-4800 ECC RDIMM",
			NameES: "Memoria Micron 32GB DDR5-4800 ECC RDIMM",
			Description: "DDR5 ECC RDIMM Micron 32GB 4800 MT/s para plataformas Intel Xeon e AMD EPYC de nova geração.",
			DescriptionES: "DDR5 ECC RDIMM Micron 32GB 4800 MT/s para plataformas Intel Xeon y AMD EPYC de nueva generación.",
			SKUName: "Micron 32GB DDR5-4800 ECC RDIMM",
			Cost: 145, Min: 180, B2C: 259, B2B: 229, Res: 215,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "32 GB"},
		},
		{
			Category: "MEM_NOTEBOOK", Brand: "Kingston", Manufacturer: "Kingston",
			Name: "Memória Kingston 16GB DDR4-3200 SODIMM",
			NameES: "Memoria Kingston 16GB DDR4-3200 SODIMM",
			Description: "SODIMM 16GB DDR4-3200 Kingston para notebooks e workstations compactas.",
			DescriptionES: "SODIMM 16GB DDR4-3200 Kingston para notebooks y workstations compactas.",
			SKUName: "Kingston 16GB DDR4-3200 SODIMM",
			Cost: 28, Min: 36, B2C: 59, B2B: 49, Res: 44,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "16 GB"},
		},
		{
			Category: "MEM_ECC", Brand: "SK Hynix", Manufacturer: "SK Hynix",
			Name: "Memória SK Hynix 128GB DDR4-3200 LRDIMM",
			NameES: "Memoria SK Hynix 128GB DDR4-3200 LRDIMM",
			Description: "LRDIMM 128GB SK Hynix para servidores de alta densidade de memória.",
			DescriptionES: "LRDIMM 128GB SK Hynix para servidores de alta densidad de memoria.",
			SKUName: "SK Hynix 128GB DDR4-3200 LRDIMM",
			Cost: 480, Min: 560, B2C: 789, B2B: 699, Res: 659,
			PublishCP: true, PublishEcom: false,
			Attrs: map[string]string{"capacidade": "128 GB"},
		},
		{
			Category: "SSD_U2", Brand: "Samsung", Manufacturer: "Samsung",
			Name: "SSD Samsung PM9A3 1.92TB U.2 NVMe",
			NameES: "SSD Samsung PM9A3 1.92TB U.2 NVMe",
			Description: "SSD enterprise U.2 NVMe Samsung PM9A3 1.92TB, perfil read-intensive para servidores e storage.",
			DescriptionES: "SSD enterprise U.2 NVMe Samsung PM9A3 1.92TB, perfil read-intensive para servidores y storage.",
			SKUName: "Samsung PM9A3 1.92TB U.2 NVMe",
			Cost: 210, Min: 260, B2C: 389, B2B: 349, Res: 329,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "1.92 TB", "perfil_endurance": "RI", "interface": "NVMe"},
		},
		{
			Category: "SSD_M2_NVME", Brand: "Samsung", Manufacturer: "Samsung",
			Name: "SSD Samsung 990 PRO 2TB M.2 NVMe",
			NameES: "SSD Samsung 990 PRO 2TB M.2 NVMe",
			Description: "SSD M.2 NVMe Gen4 Samsung 990 PRO 2TB para workstations e PCs de alto desempenho.",
			DescriptionES: "SSD M.2 NVMe Gen4 Samsung 990 PRO 2TB para workstations y PCs de alto rendimiento.",
			SKUName: "Samsung 990 PRO 2TB M.2 NVMe",
			Cost: 95, Min: 120, B2C: 189, B2B: 169, Res: 155,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "2 TB", "perfil_endurance": "MU", "interface": "NVMe"},
		},
		{
			Category: "SSD_U2", Brand: "Micron", Manufacturer: "Micron",
			Name: "SSD Micron 7450 PRO 3.84TB U.2 NVMe",
			NameES: "SSD Micron 7450 PRO 3.84TB U.2 NVMe",
			Description: "SSD U.2 NVMe Micron 7450 PRO 3.84TB mixed-use para bancos de dados e virtualização.",
			DescriptionES: "SSD U.2 NVMe Micron 7450 PRO 3.84TB mixed-use para bases de datos y virtualización.",
			SKUName: "Micron 7450 PRO 3.84TB U.2",
			Cost: 390, Min: 470, B2C: 649, B2B: 589, Res: 559,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "3.84 TB", "perfil_endurance": "MU", "interface": "NVMe"},
		},
		{
			Category: "SSD_SATA", Brand: "Intel", Manufacturer: "Solidigm",
			Name: "SSD Intel D3-S4520 1.92TB SATA",
			NameES: "SSD Intel D3-S4520 1.92TB SATA",
			Description: "SSD SATA 2.5\" Intel/Solidigm D3-S4520 1.92TB read-intensive, drop-in para arrays SATA.",
			DescriptionES: "SSD SATA 2.5\" Intel/Solidigm D3-S4520 1.92TB read-intensive, reemplazo directo para arrays SATA.",
			SKUName: "Intel D3-S4520 1.92TB SATA",
			Cost: 145, Min: 180, B2C: 269, B2B: 239, Res: 225,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "1.92 TB", "perfil_endurance": "RI", "interface": "SATA"},
		},
		{
			Category: "SSD_E3S", Brand: "Kioxia", Manufacturer: "Kioxia",
			Name: "SSD Kioxia CM7-R 7.68TB E3.S NVMe",
			NameES: "SSD Kioxia CM7-R 7.68TB E3.S NVMe",
			Description: "SSD E3.S NVMe Gen5 Kioxia CM7-R 7.68TB para densidades altas em racks EDSFF.",
			DescriptionES: "SSD E3.S NVMe Gen5 Kioxia CM7-R 7.68TB para altas densidades en racks EDSFF.",
			SKUName: "Kioxia CM7-R 7.68TB E3.S",
			Cost: 890, Min: 1050, B2C: 1490, B2B: 1340, Res: 1260,
			PublishCP: true, PublishEcom: false,
			Attrs: map[string]string{"capacidade": "7.68 TB", "perfil_endurance": "RI", "interface": "NVMe"},
		},
		{
			Category: "SSD_M2_NVME", Brand: "Solidigm", Manufacturer: "Solidigm",
			Name: "SSD Solidigm P44 Pro 2TB M.2 NVMe",
			NameES: "SSD Solidigm P44 Pro 2TB M.2 NVMe",
			Description: "SSD M.2 NVMe Solidigm P44 Pro 2TB, estoque limitado para workstations.",
			DescriptionES: "SSD M.2 NVMe Solidigm P44 Pro 2TB, stock limitado para workstations.",
			SKUName: "Solidigm P44 Pro 2TB M.2",
			Cost: 88, Min: 110, B2C: 179, B2B: 159, Res: 149,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "2 TB", "perfil_endurance": "MU", "interface": "NVMe"},
		},
		{
			Category: "HDD_3_5_SATA", Brand: "Seagate", Manufacturer: "Seagate",
			Name: "HDD Seagate Exos 16TB 3.5\" SATA 7200rpm",
			NameES: "HDD Seagate Exos 16TB 3.5\" SATA 7200rpm",
			Description: "Nearline 16TB Seagate Exos 7E10 SATA para backup, object storage e arquivos frios.",
			DescriptionES: "Nearline 16TB Seagate Exos 7E10 SATA para backup, object storage y archivo frío.",
			SKUName: "Seagate Exos 16TB SATA",
			Cost: 175, Min: 210, B2C: 289, B2B: 259, Res: 245,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "16 TB", "perfil_endurance": "RI", "interface": "SATA", "rpm": "7200", "tipo_disco": "Nearline"},
		},
		{
			Category: "HDD_3_5_NL_SAS", Brand: "Western Digital", Manufacturer: "Western Digital",
			Name: "HDD WD Ultrastar DC HC550 18TB NL-SAS",
			NameES: "HDD WD Ultrastar DC HC550 18TB NL-SAS",
			Description: "HDD enterprise 18TB WD Ultrastar HC550 NL-SAS para storage de alta capacidade.",
			DescriptionES: "HDD enterprise 18TB WD Ultrastar HC550 NL-SAS para storage de alta capacidad.",
			SKUName: "WD Ultrastar 18TB NL-SAS",
			Cost: 210, Min: 250, B2C: 339, B2B: 305, Res: 289,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "18 TB", "perfil_endurance": "RI", "interface": "SAS", "rpm": "7200", "tipo_disco": "Nearline"},
		},
		{
			Category: "HDD_3_5_SAS", Brand: "Seagate", Manufacturer: "Seagate",
			Name: "HDD Seagate Exos 12TB 3.5\" SAS 12G",
			NameES: "HDD Seagate Exos 12TB 3.5\" SAS 12G",
			Description: "HDD SAS 12Gb/s Seagate Exos 12TB para arrays enterprise.",
			DescriptionES: "HDD SAS 12Gb/s Seagate Exos 12TB para arrays enterprise.",
			SKUName: "Seagate Exos 12TB SAS",
			Cost: 145, Min: 175, B2C: 249, B2B: 219, Res: 205,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "12 TB", "perfil_endurance": "RI", "interface": "SAS", "rpm": "7200", "tipo_disco": "Enterprise"},
		},
		{
			Category: "HDD_2_5_PERF", Brand: "Toshiba", Manufacturer: "Toshiba",
			Name: "HDD Toshiba 2.4TB 2.5\" SAS 10K",
			NameES: "HDD Toshiba 2.4TB 2.5\" SAS 10K",
			Description: "HDD performance 2.5\" 10K SAS Toshiba 2.4TB para aplicações transacionais.",
			DescriptionES: "HDD performance 2.5\" 10K SAS Toshiba 2.4TB para aplicaciones transaccionales.",
			SKUName: "Toshiba 2.4TB SAS 10K",
			Cost: 95, Min: 120, B2C: 179, B2B: 159, Res: 149,
			PublishCP: false, PublishEcom: true,
			Attrs: map[string]string{"capacidade": "2.4 TB", "perfil_endurance": "MU", "interface": "SAS", "rpm": "10000", "tipo_disco": "Performance"},
		},
		{
			Category: "GPU_NVIDIA", Brand: "NVIDIA", Manufacturer: "NVIDIA",
			Name: "GPU NVIDIA RTX A4000 16GB",
			NameES: "GPU NVIDIA RTX A4000 16GB",
			Description: "Placa profissional NVIDIA RTX A4000 16GB GDDR6 para CAD, render e inferência leve.",
			DescriptionES: "Placa profesional NVIDIA RTX A4000 16GB GDDR6 para CAD, render e inferencia liviana.",
			SKUName: "NVIDIA RTX A4000 16GB",
			Cost: 780, Min: 920, B2C: 1249, B2B: 1129, Res: 1069,
			PublishCP: true, PublishEcom: true,
		},
		{
			Category: "GPU_NVIDIA", Brand: "NVIDIA", Manufacturer: "NVIDIA",
			Name: "GPU NVIDIA GeForce RTX 4090 24GB",
			NameES: "GPU NVIDIA GeForce RTX 4090 24GB",
			Description: "RTX 4090 24GB para workstations de IA, render 3D e fine-tuning de modelos pequenos.",
			DescriptionES: "RTX 4090 24GB para workstations de IA, render 3D y fine-tuning de modelos pequeños.",
			SKUName: "NVIDIA RTX 4090 24GB",
			Cost: 1650, Min: 1890, B2C: 2390, B2B: 2190, Res: 2090,
			PublishCP: true, PublishEcom: true,
		},
		{
			Category: "GPU_PROFISSIONAL", Brand: "NVIDIA", Manufacturer: "NVIDIA",
			Name: "GPU NVIDIA L40S 48GB",
			NameES: "GPU NVIDIA L40S 48GB",
			Description: "NVIDIA L40S 48GB para inferência e treino de IA em datacenter. Estoque crítico.",
			DescriptionES: "NVIDIA L40S 48GB para inferencia y entrenamiento de IA en datacenter. Stock crítico.",
			SKUName: "NVIDIA L40S 48GB",
			Cost: 7200, Min: 8200, B2C: 9890, B2B: 9290, Res: 8890,
			PublishCP: true, PublishEcom: false,
		},
		{
			Category: "GPU_AMD", Brand: "AMD", Manufacturer: "AMD",
			Name: "GPU AMD Instinct MI210 64GB",
			NameES: "GPU AMD Instinct MI210 64GB",
			Description: "Acelerador AMD Instinct MI210 64GB HBM2e para HPC e treino de modelos.",
			DescriptionES: "Acelerador AMD Instinct MI210 64GB HBM2e para HPC y entrenamiento de modelos.",
			SKUName: "AMD Instinct MI210 64GB",
			Cost: 5400, Min: 6100, B2C: 7490, B2B: 6990, Res: 6690,
			PublishCP: false, PublishEcom: false,
		},
		{
			Category: "GPU_PROFISSIONAL", Brand: "NVIDIA", Manufacturer: "NVIDIA",
			Name: "GPU NVIDIA RTX A6000 48GB",
			NameES: "GPU NVIDIA RTX A6000 48GB",
			Description: "RTX A6000 48GB para workstations profissionais de render, CAD e visualização.",
			DescriptionES: "RTX A6000 48GB para workstations profesionales de render, CAD y visualización.",
			SKUName: "NVIDIA RTX A6000 48GB",
			Cost: 3100, Min: 3600, B2C: 4590, B2B: 4190, Res: 3990,
			PublishCP: true, PublishEcom: true,
		},
		{
			Category: "GPU_PROFISSIONAL", Brand: "NVIDIA", Manufacturer: "NVIDIA",
			Name: "GPU NVIDIA RTX 6000 Ada Generation 48GB",
			NameES: "GPU NVIDIA RTX 6000 Ada Generation 48GB",
			Description: "NVIDIA RTX 6000 Ada Generation 48GB GDDR6 ECC — GPU profissional Ada Lovelace para CAD, render, visualização e IA em workstations.",
			DescriptionES: "NVIDIA RTX 6000 Ada Generation 48GB GDDR6 ECC — GPU profesional Ada Lovelace para CAD, render, visualización e IA en workstations.",
			SKUName: "NVIDIA RTX 6000 Ada Generation",
			Cost: 5200, Min: 5900, B2C: 7490, B2B: 6890, Res: 6490,
			PublishCP: true, PublishEcom: true,
		},
		{
			Category: "REDE_SFP_PLUS", Brand: "Intel", Manufacturer: "Intel",
			Name: "Placa Intel X710-DA2 Dual SFP+ 10GbE",
			NameES: "Placa Intel X710-DA2 Dual SFP+ 10GbE",
			Description: "NIC Intel X710 dual SFP+ 10GbE para servidores e hypervisors.",
			DescriptionES: "NIC Intel X710 dual SFP+ 10GbE para servidores e hypervisors.",
			SKUName: "Intel X710-DA2 SFP+ 10G",
			Cost: 145, Min: 175, B2C: 249, B2B: 219, Res: 205,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"velocidade": "10 Gbps", "tipo_conector": "SFP+", "portas": "2", "protocolo": "Ethernet"},
		},
		{
			Category: "REDE_SFP28", Brand: "NVIDIA", Manufacturer: "NVIDIA",
			Name: "Placa NVIDIA ConnectX-6 Dx Dual 25GbE",
			NameES: "Placa NVIDIA ConnectX-6 Dx Dual 25GbE",
			Description: "ConnectX-6 Dx dual 25GbE SFP28 para low-latency e RDMA em clusters.",
			DescriptionES: "ConnectX-6 Dx dual 25GbE SFP28 para baja latencia y RDMA en clusters.",
			SKUName: "NVIDIA ConnectX-6 Dx 25G",
			Cost: 310, Min: 370, B2C: 529, B2B: 479, Res: 449,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"velocidade": "25 Gbps", "tipo_conector": "SFP28", "portas": "2", "protocolo": "Ethernet / RDMA"},
		},
		{
			Category: "REDE_RJ45_1G", Brand: "Broadcom", Manufacturer: "Broadcom",
			Name: "Placa Broadcom BCM57416 Dual 10GBase-T",
			NameES: "Placa Broadcom BCM57416 Dual 10GBase-T",
			Description: "NIC Broadcom 10GBase-T dual RJ45 para upgrades sem fibra.",
			DescriptionES: "NIC Broadcom 10GBase-T dual RJ45 para actualizaciones sin fibra.",
			SKUName: "Broadcom 57416 10GBase-T",
			Cost: 95, Min: 120, B2C: 179, B2B: 159, Res: 149,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"velocidade": "10 Gbps", "tipo_conector": "RJ45", "portas": "2", "protocolo": "Ethernet"},
		},
		{
			Category: "REDE_HBA_FC", Brand: "Marvell", Manufacturer: "Marvell",
			Name: "HBA QLogic QLE2692 Dual 16G Fibre Channel",
			NameES: "HBA QLogic QLE2692 Dual 16G Fibre Channel",
			Description: "HBA FC 16G QLogic QLE2692 dual-port para SAN.",
			DescriptionES: "HBA FC 16G QLogic QLE2692 dual-port para SAN.",
			SKUName: "QLogic QLE2692 16G FC",
			Cost: 220, Min: 270, B2C: 389, B2B: 349, Res: 329,
			PublishCP: false, PublishEcom: true,
			Attrs: map[string]string{"velocidade": "16 Gbps", "tipo_conector": "SFP+ FC", "portas": "2", "protocolo": "Fibre Channel"},
		},
		{
			Category: "REDE_RJ45_1G", Brand: "Intel", Manufacturer: "Intel",
			Name: "Placa Intel I350-T4 Quad Gigabit RJ45",
			NameES: "Placa Intel I350-T4 Quad Gigabit RJ45",
			Description: "NIC Intel I350-T4 4x1GbE RJ45, padrão de servidores de entrada.",
			DescriptionES: "NIC Intel I350-T4 4x1GbE RJ45, estándar de servidores de entrada.",
			SKUName: "Intel I350-T4 1G Quad",
			Cost: 48, Min: 62, B2C: 99, B2B: 85, Res: 79,
			PublishCP: true, PublishEcom: true,
			Attrs: map[string]string{"velocidade": "1 Gbps", "tipo_conector": "RJ45", "portas": "4", "protocolo": "Ethernet"},
		},
		{
			Category: "FONTE_ATX", Brand: "Corsair", Manufacturer: "Corsair",
			Name: "Fonte Corsair RM850x 850W 80+ Gold",
			NameES: "Fuente Corsair RM850x 850W 80+ Gold",
			Description: "Fonte modular Corsair RM850x 850W 80 Plus Gold para workstations.",
			DescriptionES: "Fuente modular Corsair RM850x 850W 80 Plus Gold para workstations.",
			SKUName: "Corsair RM850x 850W Gold",
			Cost: 85, Min: 105, B2C: 159, B2B: 139, Res: 129,
			PublishCP: true, PublishEcom: true,
		},
		{
			Category: "FONTE_REDUNDANTE", Brand: "Supermicro", Manufacturer: "Supermicro",
			Name: "Fonte Supermicro 1200W Redundante 80+ Platinum",
			NameES: "Fuente Supermicro 1200W Redundante 80+ Platinum",
			Description: "PSU redundante 1200W Supermicro para chassis 2U/4U de datacenter.",
			DescriptionES: "PSU redundante 1200W Supermicro para chasis 2U/4U de datacenter.",
			SKUName: "Supermicro 1200W redundante",
			Cost: 210, Min: 255, B2C: 379, B2B: 339, Res: 319,
			PublishCP: true, PublishEcom: false,
		},
		{
			Category: "FONTE_MODULAR", Brand: "Seasonic", Manufacturer: "Seasonic",
			Name: "Fonte Seasonic Prime TX-1000 1000W Titanium",
			NameES: "Fuente Seasonic Prime TX-1000 1000W Titanium",
			Description: "Fonte Seasonic Prime TX-1000 80 Plus Titanium para workstations de GPU.",
			DescriptionES: "Fuente Seasonic Prime TX-1000 80 Plus Titanium para workstations de GPU.",
			SKUName: "Seasonic Prime 1000W Titanium",
			Cost: 175, Min: 210, B2C: 329, B2B: 289, Res: 269,
			PublishCP: true, PublishEcom: true,
		},
	}
	return append(items, extraCatalogItems()...)
}

func seedCatalog(ctx context.Context, pool *pgxpool.Pool) (map[string]catalogSKU, error) {
	catIDs := map[string]uuid.UUID{}
	rows, err := pool.Query(ctx, `SELECT id, code FROM categories`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var code string
		if err := rows.Scan(&id, &code); err != nil {
			return nil, err
		}
		catIDs[code] = id
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := map[string]catalogSKU{}
	for _, item := range catalogItems() {
		catID, ok := catIDs[item.Category]
		if !ok {
			return nil, fmt.Errorf("categoria %s não encontrada", item.Category)
		}
		productID := item.FixedProductID
		if productID == uuid.Nil {
			productID = uuid.New()
		}
		shortES := item.NameES
		if item.Attrs["capacidade"] != "" {
			shortES = item.NameES + " " + item.Attrs["capacidade"]
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO products (id, name, category_id, brand, manufacturer, description, generated_description,
			                      name_es, description_es, generated_description_es)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, productID, item.Name, catID, item.Brand, item.Manufacturer, item.Description, item.Name,
			item.NameES, item.DescriptionES, shortES)
		if err != nil {
			return nil, fmt.Errorf("product %s: %w", item.Name, err)
		}

		for code, value := range item.Attrs {
			var attrID uuid.UUID
			err := pool.QueryRow(ctx, `
				SELECT id FROM category_attributes WHERE category_id = $1 AND code = $2
			`, catID, code).Scan(&attrID)
			if err != nil {
				return nil, fmt.Errorf("attr %s/%s: %w", item.Category, code, err)
			}
			_, err = pool.Exec(ctx, `
				INSERT INTO product_attribute_values (product_id, category_attribute_id, value_text)
				VALUES ($1, $2, $3)
			`, productID, attrID, value)
			if err != nil {
				return nil, err
			}
		}

		skuID := item.FixedSKUID
		skuCode := item.FixedCode
		if skuID == uuid.Nil {
			skuID = uuid.New()
			err := pool.QueryRow(ctx, `SELECT generate_sku_code()`).Scan(&skuCode)
			if err != nil {
				return nil, err
			}
		}
		_, err = pool.Exec(ctx, `
			INSERT INTO skus (id, product_id, code, name, description, publish_compras_paraguai, publish_ecommerce)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, skuID, productID, skuCode, item.SKUName, item.Description, item.PublishCP, item.PublishEcom)
		if err != nil {
			return nil, fmt.Errorf("sku %s: %w", item.SKUName, err)
		}
		_, err = pool.Exec(ctx, `
			INSERT INTO sku_prices (sku_id, cost_usd, min_price_usd, price_b2c_usd, price_b2b_usd, price_reseller_usd)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, skuID, item.Cost, item.Min, item.B2C, item.B2B, item.Res)
		if err != nil {
			return nil, err
		}
		out[skuCode] = catalogSKU{
			ID: skuID, Code: skuCode, Name: item.SKUName,
			Cost: item.Cost, Min: item.Min, B2C: item.B2C, B2B: item.B2B, Reseller: item.Res,
		}
		if item.FixedCode == "000001" {
			if _, err := pool.Exec(ctx, `SELECT setval('sku_code_seq', 1, true)`); err != nil {
				return nil, err
			}
		}
	}
	return out, nil
}
