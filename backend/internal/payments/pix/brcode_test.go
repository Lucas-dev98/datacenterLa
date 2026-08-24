package pix

import (
	"strings"
	"testing"
)

func TestDynamicChargeFormat(t *testing.T) {
	cfg := Config{
		Key:          "123e4567-e12b-12d1-a456-426614174000",
		MerchantName: "Data Center LA",
		MerchantCity: "Asuncion",
	}
	payload, err := DynamicCharge(cfg, 52.35, "PED001014")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(payload, "000201") {
		t.Fatalf("expected EMV prefix, got %q", payload[:6])
	}
	if !strings.Contains(payload, "br.gov.bcb.pix") {
		t.Fatal("missing pix gui")
	}
	if !strings.Contains(payload, cfg.Key) {
		t.Fatal("missing pix key")
	}
	if !strings.Contains(payload, "52.35") {
		t.Fatal("missing amount")
	}
	if len(payload) < 20 || payload[len(payload)-4:] == "0000" {
		t.Fatal("expected valid crc suffix")
	}
}

func TestSanitizeTXID(t *testing.T) {
	if got := sanitizeTXID("PED-001014"); got != "PED001014" {
		t.Fatalf("got %q", got)
	}
}
