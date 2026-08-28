package main

func extraCatalogItems() []catalogItem {
	return []catalogItem{
		// —— Memória de servidor ——
		mem("MEM_SERVIDOR", "Samsung", "16GB DDR4-3200 ECC RDIMM", "16 GB", 58, 75, 109, 95, 89),
		mem("MEM_SERVIDOR", "Samsung", "128GB DDR4-3200 ECC RDIMM", "128 GB", 890, 1050, 1490, 1340, 1260),
		mem("MEM_SERVIDOR", "Samsung", "32GB DDR4-2666 ECC RDIMM", "32 GB", 95, 120, 169, 149, 139),
		mem("MEM_ECC", "Micron", "16GB DDR4-3200 ECC RDIMM", "16 GB", 52, 68, 99, 89, 82),
		mem("MEM_ECC", "Micron", "64GB DDR5-4800 ECC RDIMM", "64 GB", 310, 380, 529, 479, 449),
		mem("MEM_ECC", "Micron", "96GB DDR5-5600 ECC RDIMM", "96 GB", 420, 510, 699, 629, 589),
		mem("MEM_ECC", "Micron", "256GB DDR4-3200 LRDIMM", "256 GB", 980, 1180, 1690, 1520, 1440),
		mem("MEM_SERVIDOR", "SK Hynix", "32GB DDR4-2933 ECC RDIMM", "32 GB", 88, 110, 159, 139, 129),
		mem("MEM_ECC", "SK Hynix", "64GB DDR5-4800 ECC RDIMM", "64 GB", 295, 360, 499, 449, 419),
		mem("MEM_SERVIDOR", "Kingston", "32GB DDR4-3200 ECC RDIMM", "32 GB", 105, 130, 189, 169, 155),
		mem("MEM_DDR5", "Micron", "32GB DDR5-5600 ECC RDIMM", "32 GB", 165, 205, 289, 259, 239),
		mem("MEM_NOTEBOOK", "Kingston", "8GB DDR4-3200 SODIMM", "8 GB", 16, 22, 39, 32, 29),
		mem("MEM_NOTEBOOK", "Crucial", "16GB DDR5-5600 SODIMM", "16 GB", 38, 48, 79, 69, 62),
		mem("MEM_DDR4", "Samsung", "16GB DDR4-3200 UDIMM", "16 GB", 22, 30, 49, 42, 38),

		// —— SSD ——
		ssd("SSD_U2", "Samsung", "PM9A3 3.84TB U.2 NVMe", "3.84 TB", "RI", "NVMe", 390, 470, 649, 589, 559),
		ssd("SSD_M2_NVME", "Samsung", "990 PRO 1TB M.2 NVMe", "1 TB", "MU", "NVMe", 55, 72, 119, 105, 95),
		ssd("SSD_U2", "Micron", "7450 MAX 1.6TB U.2 NVMe", "1.6 TB", "WI", "NVMe", 280, 340, 479, 429, 399),
		ssd("SSD_SAS", "Kioxia", "CM6-R 3.84TB SAS 24G", "3.84 TB", "RI", "SAS", 410, 490, 679, 609, 575),
		ssd("SSD_U2", "Solidigm", "D7-P5520 1.92TB U.2 NVMe", "1.92 TB", "MU", "NVMe", 230, 280, 399, 359, 339),
		ssd("SSD_U2", "Western Digital", "Ultrastar DC SN655 7.68TB U.2", "7.68 TB", "RI", "NVMe", 780, 920, 1290, 1160, 1090),
		ssd("SSD_SATA", "Samsung", "870 EVO 1TB SATA 2.5\"", "1 TB", "MU", "SATA", 42, 55, 89, 75, 69),
		ssd("SSD_SATA", "Kingston", "DC600M 1.92TB SATA enterprise", "1.92 TB", "RI", "SATA", 135, 170, 249, 219, 205),
		ssd("SSD_E1S", "Kioxia", "CD8-R 1.92TB E1.S NVMe", "1.92 TB", "RI", "NVMe", 245, 300, 429, 389, 365),
		ssd("SSD_PCIE_GEN5_AI", "Micron", "9550 PRO 6.4TB PCIe Gen5", "6.4 TB", "MU", "NVMe", 920, 1100, 1590, 1440, 1350),
		ssd("SSD_SAS", "Samsung", "PM1653 2.4TB SAS 24G", "2.4 TB", "MU", "SAS", 310, 375, 529, 479, 449),
		ssd("SSD_M2_NVME", "Solidigm", "P44 Pro 1TB M.2 NVMe", "1 TB", "MU", "NVMe", 48, 62, 109, 95, 88),

		// —— Placas de rede / HBA ——
		nic("REDE_SFP_PLUS", "Intel", "X710-T4 Quad 10GBase-T", "10 Gbps", "RJ45", "4", "Ethernet", 220, 270, 389, 349, 329),
		nic("REDE_SFP28", "Intel", "XXV710-DA2 Dual 25GbE SFP28", "25 Gbps", "SFP28", "2", "Ethernet", 195, 240, 349, 309, 289),
		nic("REDE_SFP28", "NVIDIA", "ConnectX-5 Dual 25GbE", "25 Gbps", "SFP28", "2", "Ethernet / RDMA", 175, 215, 319, 285, 265),
		nic("REDE_QSFP28", "NVIDIA", "ConnectX-6 100GbE QSFP56", "100 Gbps", "QSFP56", "1", "Ethernet / InfiniBand", 480, 580, 829, 749, 699),
		nic("REDE_QSFP28", "NVIDIA", "ConnectX-7 Dual 200GbE", "200 Gbps", "QSFP112", "2", "Ethernet / InfiniBand", 890, 1050, 1490, 1340, 1260),
		nic("REDE_QSFP28", "Broadcom", "BCM57508 Dual 100GbE", "100 Gbps", "QSFP28", "2", "Ethernet", 410, 490, 699, 629, 589),
		nic("REDE_HBA_SAS", "Broadcom", "LSI 9300-8i HBA SAS 12G", "12 Gbps", "SFF-8643", "8", "SAS / SATA", 145, 180, 259, 229, 215),
		nic("REDE_HBA_SAS", "Broadcom", "LSI 9500-16i HBA SAS 24G", "24 Gbps", "SFF-8654", "16", "SAS / NVMe", 310, 375, 529, 479, 449),
		nic("REDE_HBA_FC", "Marvell", "QLogic QLE2772 Dual 32G FC", "32 Gbps", "SFP28 FC", "2", "Fibre Channel", 390, 470, 649, 589, 559),
		nic("REDE_RJ45_1G", "Intel", "I210-T1 Gigabit RJ45", "1 Gbps", "RJ45", "1", "Ethernet", 18, 24, 39, 32, 29),
		nic("REDE_SFP_PLUS", "Intel", "X520-DA2 Dual SFP+ 10GbE", "10 Gbps", "SFP+", "2", "Ethernet", 85, 110, 169, 149, 139),
		nic("REDE_SFP_1G", "Intel", "I350-F2 Dual SFP 1GbE", "1 Gbps", "SFP", "2", "Ethernet", 62, 80, 129, 115, 105),

		// —— Processadores ——
		cpu("CPU_INTEL", "Intel", "Xeon Gold 6430 32C/64T", "LGA 4677", "32 / 64", "2.1 GHz (3.4 turbo)", 1850, 2200, 2890, 2590, 2450),
		cpu("CPU_INTEL", "Intel", "Xeon Silver 4314 16C/32T", "LGA 4189", "16 / 32", "2.4 GHz (3.4 turbo)", 620, 760, 1090, 980, 920),
		cpu("CPU_INTEL", "Intel", "Xeon Platinum 8480+ 56C/112T", "LGA 4677", "56 / 112", "2.0 GHz (3.8 turbo)", 6200, 7200, 9890, 8990, 8490),
		cpu("CPU_INTEL", "Intel", "Xeon Gold 5318Y 24C/48T", "LGA 4189", "24 / 48", "2.1 GHz (3.4 turbo)", 980, 1180, 1690, 1520, 1440),
		cpu("CPU_INTEL", "Intel", "Xeon Silver 4410Y 12C/24T", "LGA 4677", "12 / 24", "2.0 GHz (3.9 turbo)", 410, 510, 749, 669, 629),
		cpu("CPU_AMD", "AMD", "EPYC 9354 32C/64T Genoa", "SP5", "32 / 64", "3.25 GHz (3.8 turbo)", 2100, 2500, 3490, 3140, 2960),
		cpu("CPU_AMD", "AMD", "EPYC 9124 16C/32T Genoa", "SP5", "16 / 32", "3.0 GHz (3.7 turbo)", 780, 950, 1390, 1240, 1160),
		cpu("CPU_AMD", "AMD", "EPYC 9654 96C/192T Genoa", "SP5", "96 / 192", "2.4 GHz (3.7 turbo)", 7800, 8900, 12490, 11290, 10690),
		cpu("CPU_AMD", "AMD", "EPYC 7763 64C/128T Milan", "SP3", "64 / 128", "2.45 GHz (3.5 turbo)", 3200, 3800, 5290, 4790, 4490),
		cpu("CPU_AMD", "AMD", "EPYC 7543 32C/64T Milan", "SP3", "32 / 64", "2.8 GHz (3.7 turbo)", 1450, 1750, 2490, 2240, 2090),

		// —— Servidores ——
		server("SRV_RACK_2U", "Dell", "PowerEdge R750 2U (sem CPU/RAM)", "2U rack", "LGA 4189 / Ice Lake", 2100, 2500, 3490, 3140, 2960),
		server("SRV_RACK_1U", "Dell", "PowerEdge R650 1U (sem CPU/RAM)", "1U rack", "LGA 4189 / Ice Lake", 1850, 2200, 3090, 2790, 2620),
		server("SRV_RACK_2U", "HPE", "ProLiant DL380 Gen10 Plus 2U", "2U rack", "LGA 4189 / Ice Lake", 1980, 2350, 3290, 2960, 2790),
		server("SRV_RACK_1U", "HPE", "ProLiant DL360 Gen10 Plus 1U", "1U rack", "LGA 4189 / Ice Lake", 1720, 2050, 2890, 2590, 2450),
		server("SRV_RACK_2U", "Supermicro", "SYS-220U-TNR 2U dual Xeon", "2U rack", "LGA 4189 / Ice Lake", 1650, 1980, 2790, 2510, 2360),
		server("SRV_RACK_2U", "Lenovo", "ThinkSystem SR650 V3 2U", "2U rack", "LGA 4677 / Sapphire Rapids", 2400, 2850, 3990, 3590, 3380),
		server("SRV_RACK_1U", "Supermicro", "AS-1115CS-TNR 1U EPYC Genoa", "1U rack", "SP5 / Genoa", 1550, 1850, 2590, 2330, 2190),
		server("SRV_TOWER", "Dell", "Precision 7960 Tower workstation", "Torre", "LGA 4677 / Xeon W", 2800, 3300, 4590, 4140, 3890),

		// —— Storages (equipamentos NAS/SAN/JBOD, não discos) ——
		storage("STG_SAN", "Seagate", "Exos X 2U12 12 baias SAS", "2U rack", "12 baias 3.5\"", "SAS 12G / iSCSI", 4200, 4900, 6790, 6120, 5750),
		storage("STG_DAS", "Seagate", "Exos E 5U84 JBOD 84 baias", "5U rack", "84 baias 3.5\"", "SAS 12G", 8900, 10200, 13990, 12690, 11990),
		storage("STG_SAN", "Seagate", "Exos CORVAULT 4U106", "4U rack", "106 baias 3.5\"", "SAS 12G / ADAPT", 18500, 21200, 28990, 26290, 24790),
		storage("STG_NAS", "Synology", "RackStation RS3621xs+", "2U rack", "12 baias 3.5\"", "SMB / NFS / iSCSI", 2800, 3300, 4590, 4140, 3890),
		storage("STG_SAN", "Dell", "PowerVault ME5024", "2U rack", "24 baias 2.5\"", "iSCSI / FC / SAS", 5400, 6200, 8490, 7690, 7240),
		storage("STG_SAN", "HPE", "MSA 2060 24G SAN", "2U rack", "24 baias 2.5\"", "FC / iSCSI / SAS", 5100, 5900, 7990, 7240, 6820),
		storage("STG_NAS", "NetApp", "FAS2750 hybrid NAS/SAN", "2U rack", "12 baias 3.5\"", "NFS / SMB / iSCSI", 7800, 8900, 12490, 11290, 10690),
		storage("STG_NAS", "QNAP", "TS-h1290FX 12 baias U.2", "2U rack", "12 baias U.2", "NFS / SMB / iSCSI", 3900, 4500, 6290, 5690, 5350),
		storage("STG_SAN", "Lenovo", "ThinkSystem DE2000H", "2U rack", "24 baias 2.5\"", "iSCSI / SAS", 3600, 4200, 5890, 5320, 4990),

		// —— Switches ——
		sw("SW_ACCESS", "Cisco", "Catalyst 9300 48p 1G", "1U rack", "48×1G + 4 SFP+", "1/10 GbE", 2100, 2500, 3490, 3140, 2960),
		sw("SW_DATACENTER", "Cisco", "Nexus 93180YC-FX 48p 25G", "1U rack", "48×25G + 6 QSFP28", "25/100 GbE", 6200, 7200, 9890, 8990, 8490),
		sw("SW_ACCESS", "HPE", "Aruba 2930F 48G PoE+", "1U rack", "48×1G PoE+ + 4 SFP+", "1/10 GbE", 1450, 1750, 2490, 2240, 2090),
		sw("SW_DATACENTER", "Arista", "7050SX-64 10/40GbE", "1U rack", "48×10G + 4 QSFP+", "10/40 GbE", 4100, 4800, 6690, 6040, 5690),
		sw("SW_ACCESS", "Juniper", "EX4300-48T", "1U rack", "48×1G + 4 SFP+", "1/10 GbE", 1680, 1980, 2790, 2510, 2360),
	}
}

func mem(cat, brand, model, cap string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "Memória " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: "Memoria " + brand + " " + model,
		Description: name + " para servidores e workstations.",
		DescriptionES: "Memoria " + brand + " " + model + " para servidores y workstations.",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: true,
		Attrs: map[string]string{"capacidade": cap},
	}
}

func ssd(cat, brand, model, cap, endurance, iface string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "SSD " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: name,
		Description: name + " enterprise, perfil " + endurance + ".",
		DescriptionES: name + " enterprise, perfil " + endurance + ".",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: true,
		Attrs: map[string]string{"capacidade": cap, "perfil_endurance": endurance, "interface": iface},
	}
}

func nic(cat, brand, model, speed, connector, ports, proto string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "Placa " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: name,
		Description: name + " para servidores e storage.",
		DescriptionES: name + " para servidores y storage.",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: true,
		Attrs: map[string]string{"velocidade": speed, "tipo_conector": connector, "portas": ports, "protocolo": proto},
	}
}

func cpu(cat, brand, model, socket, cores, freq string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "Processador " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: "Procesador " + brand + " " + model,
		Description: name + ", socket " + socket + ", " + cores + " núcleos/threads.",
		DescriptionES: "Procesador " + brand + " " + model + ", socket " + socket + ".",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: cat != "CPU_AMD" || cost < 5000,
		Attrs: map[string]string{"socket": socket, "nucleos": cores, "frequencia": freq},
	}
}

func server(cat, brand, model, form, socket string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "Servidor " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: "Servidor " + brand + " " + model,
		Description: name + " — chassis " + form + ", plataforma " + socket + ". Vendida sem CPU/RAM (configurar à parte).",
		DescriptionES: "Servidor " + brand + " " + model + " — chasis " + form + ".",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: true,
		Attrs: map[string]string{"form_factor": form, "socket": socket},
	}
}

func storage(cat, brand, model, form, bays, proto string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "Storage " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: name,
		Description: name + " — " + form + ", " + bays + ", " + proto + ".",
		DescriptionES: name + " — " + form + ", " + bays + ".",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: true,
		Attrs: map[string]string{"form_factor": form, "baias": bays, "protocolo": proto},
	}
}

func sw(cat, brand, model, form, ports, speed string, cost, min, b2c, b2b, res float64) catalogItem {
	name := "Switch " + brand + " " + model
	return catalogItem{
		Category: cat, Brand: brand, Manufacturer: brand,
		Name: name, NameES: name,
		Description: name + " — " + form + ", " + ports + ", " + speed + ".",
		DescriptionES: name + " — " + form + ", " + ports + ".",
		SKUName: brand + " " + model,
		Cost: cost, Min: min, B2C: b2c, B2B: b2b, Res: res,
		PublishCP: true, PublishEcom: true,
		Attrs: map[string]string{"form_factor": form, "portas": ports, "velocidade": speed},
	}
}
