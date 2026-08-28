package repository

import (
	"strings"
	"testing"
)

func TestCatalogTokens(t *testing.T) {
	got := catalogTokens("placa de rede")
	if len(got) != 2 || got[0] != "placa" || got[1] != "rede" {
		t.Fatalf("got %#v", got)
	}
	got = catalogTokens("SSD Enterprise")
	if len(got) != 1 || got[0] != "ssd" {
		t.Fatalf("enterprise should be dropped, got %#v", got)
	}
	got = catalogTokens("Memória ECC")
	if len(got) != 2 || got[0] != "memoria" || got[1] != "ecc" {
		t.Fatalf("got %#v", got)
	}
}

func TestCatalogCompact(t *testing.T) {
	if got := catalogCompact("DL-380 Gen10"); got != "dl380gen10" {
		t.Fatalf("got %q", got)
	}
}

func TestCatalogPadSKU(t *testing.T) {
	if got := catalogPadSKU("78"); got != "000078" {
		t.Fatalf("got %q", got)
	}
}

func TestCatalogPatternsIncludeAliases(t *testing.T) {
	pats := catalogPatternsForToken("cpu", []string{"cpu"})
	joined := strings.Join(pats, " ")
	for _, want := range []string{"xeon", "epyc", "processador"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("missing %s in %#v", want, pats)
		}
	}
	if strings.Contains(joined, "cpu") {
		t.Fatalf("literal cpu should be skipped, got %#v", pats)
	}
	rede := strings.Join(catalogPatternsForToken("rede", []string{"placa", "rede"}), " ")
	for _, want := range []string{"nic", "ethernet", "x710"} {
		if !strings.Contains(rede, want) {
			t.Fatalf("placa de rede should expand to %s, got %s", want, rede)
		}
	}
}

func TestCatalogSearchSQLAndTokens(t *testing.T) {
	sql, args, n := catalogSearchSQL("R650", nil, 2)
	if sql == "" || n <= 2 || len(args) == 0 {
		t.Fatalf("empty search sql")
	}
	if !strings.Contains(sql, "AND") {
		t.Fatalf("expected AND clause, got %s", sql)
	}
}
