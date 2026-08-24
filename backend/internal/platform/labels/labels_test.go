package labels

import (
	"strings"
	"testing"
)

func TestFormatCadastroDescription(t *testing.T) {
	brand := "Samsung"
	desc := FormatCadastroDescription("Memória", []string{"DDR4", "32 GB", "3200 MHz", "ECC", "RDIMM"}, &brand)
	if !strings.Contains(desc, "DDR4") || !strings.Contains(desc, "SAMSUNG") {
		t.Fatalf("unexpected: %q", desc)
	}
}

func TestBuildCadastroLabel(t *testing.T) {
	l := BuildCadastroLabel("MEMORIA DDR4 32GB", "42")
	if l.SKU != "000042" {
		t.Fatalf("sku padded: %s", l.SKU)
	}
	if len(l.Lines) != 2 {
		t.Fatalf("lines: %v", l.Lines)
	}
}

func TestBuildUnitLabel(t *testing.T) {
	l := BuildUnitLabel("aaa0001", "MEMORIA DDR4", "000042")
	if l.UnitCode != "AAA0001" {
		t.Fatalf("unit code: %s", l.UnitCode)
	}
}
