package main

import "strings"

const skuImagePrefix = "/static/products/"

func defaultSKUImageURL(category, skuName string) string {
	name := strings.ToLower(skuName)
	cat := strings.ToUpper(strings.TrimSpace(category))

	switch {
	case strings.Contains(name, "rtx 6000 ada"):
		return skuImagePrefix + "gpu-nvidia-rtx-6000-ada.jpg"
	case strings.Contains(name, "poweredge r650"):
		return skuImagePrefix + "dell-poweredge-r650.png"
	case strings.Contains(name, "poweredge r750"):
		return skuImagePrefix + "dell-poweredge-r750.png"
	case strings.Contains(name, "dl380") && (strings.Contains(name, "plus") || strings.Contains(name, "gen10+")):
		return skuImagePrefix + "hpe-dl380-gen10-plus.jpg"
	case strings.Contains(name, "sr650") && strings.Contains(name, "lenovo"):
		return skuImagePrefix + "lenovo-sr650-v3.jpg"
	case strings.Contains(name, "dl380") || strings.Contains(name, "dl360") || strings.Contains(name, "proliant"):
		return skuImagePrefix + "hpe-dl380.jpg"
	}

	switch {
	case strings.HasPrefix(cat, "MEM_NOTEBOOK"):
		return skuImagePrefix + "rdimm-hynix.jpg"
	case strings.HasPrefix(cat, "MEM_DDR5"):
		return skuImagePrefix + "rdimm-ddr5-ecc.png"
	case strings.HasPrefix(cat, "MEM_"):
		return skuImagePrefix + "rdimm-micron.jpg"
	case strings.HasPrefix(cat, "SSD_M2"):
		return skuImagePrefix + "ssd-m2.jpg"
	case strings.HasPrefix(cat, "SSD_SATA"):
		return skuImagePrefix + "ssd-sata.jpg"
	case strings.HasPrefix(cat, "SSD_"):
		return skuImagePrefix + "ssd-u2.jpg"
	case strings.HasPrefix(cat, "HDD_"):
		return skuImagePrefix + "hdd-exos.jpg"
	case strings.HasPrefix(cat, "GPU_"):
		return skuImagePrefix + "gpu-nvidia.jpg"
	case strings.HasPrefix(cat, "FONTE_"):
		return skuImagePrefix + "psu-atx.jpg"
	case strings.HasPrefix(cat, "REDE_"):
		return skuImagePrefix + "nic-intel.jpg"
	case strings.HasPrefix(cat, "CPU_AMD"):
		return skuImagePrefix + "amd-epyc.jpg"
	case strings.HasPrefix(cat, "CPU_INTEL"):
		return skuImagePrefix + "intel-xeon.jpg"
	case cat == "SRV_RACK_1U":
		return skuImagePrefix + "dell-poweredge-1u.jpg"
	case strings.HasPrefix(cat, "SRV_"):
		return skuImagePrefix + "dell-poweredge-rack.jpg"
	case strings.HasPrefix(cat, "STG_") && (strings.Contains(name, "exos") || strings.Contains(name, "seagate") && strings.Contains(name, "corvault")):
		return skuImagePrefix + "seagate-exos-chassis.png"
	case cat == "STG_NAS" && (strings.Contains(name, "synology") || strings.Contains(name, "qnap")):
		return skuImagePrefix + "storage-nas.jpg"
	case strings.HasPrefix(cat, "STG_"):
		return skuImagePrefix + "storage-san.jpg"
	case strings.HasPrefix(cat, "SW_"):
		return skuImagePrefix + "cisco-catalyst.jpg"
	default:
		return skuImagePrefix + "placeholder.svg"
	}
}
