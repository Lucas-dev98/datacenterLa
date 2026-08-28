package main

import (
	"strings"
	"testing"
)

func TestDefaultSKUImageURL(t *testing.T) {
	cases := []struct {
		cat, name, want string
	}{
		{"SRV_RACK_1U", "Dell PowerEdge R650 1U", "dell-poweredge-r650.png"},
		{"CPU_AMD", "AMD EPYC 7543 32C/64T Milan", "amd-epyc.jpg"},
		{"MEM_SERVIDOR", "Samsung 32GB DDR4-3200 ECC RDIMM", "rdimm-micron.jpg"},
		{"STG_SAN", "Seagate Exos X 2U12 12 baias SAS", "seagate-exos-chassis.png"},
		{"SW_ACCESS", "Cisco Catalyst 9300 48p 1G", "cisco-catalyst.jpg"},
	}
	for _, c := range cases {
		got := defaultSKUImageURL(c.cat, c.name)
		if !strings.Contains(got, c.want) {
			t.Fatalf("%s %s: got %s want substring %s", c.cat, c.name, got, c.want)
		}
	}
}
