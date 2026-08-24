package pix

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Key          string
	MerchantName string
	MerchantCity string
}

func ConfigFromEnv() Config {
	name := strings.TrimSpace(os.Getenv("PIX_MERCHANT_NAME"))
	if name == "" {
		name = "Data Center LA"
	}
	city := strings.TrimSpace(os.Getenv("PIX_MERCHANT_CITY"))
	if city == "" {
		city = "Asuncion"
	}
	key := strings.TrimSpace(os.Getenv("PIX_KEY"))
	return Config{
		Key:          key,
		MerchantName: truncate(name, 25),
		MerchantCity: truncate(city, 15),
	}
}

func (c Config) Ready() bool {
	return c.Key != ""
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// DynamicCharge builds PIX Copia e Cola (EMV BR Code) for a BRL amount.
func DynamicCharge(cfg Config, amountBRL float64, txid string) (string, error) {
	if !cfg.Ready() {
		return "", fmt.Errorf("pix key not configured")
	}
	if amountBRL <= 0 {
		return "", fmt.Errorf("invalid amount")
	}
	txid = sanitizeTXID(txid)
	amount := fmt.Sprintf("%.2f", amountBRL)

	merchantAccount := tlv("00", "br.gov.bcb.pix") + tlv("01", cfg.Key)
	payload := tlv("00", "01") +
		tlv("26", merchantAccount) +
		tlv("52", "0000") +
		tlv("53", "986") +
		tlv("54", amount) +
		tlv("58", "BR") +
		tlv("59", cfg.MerchantName) +
		tlv("60", cfg.MerchantCity) +
		tlv("62", tlv("05", txid))

	payload += "6304"
	crc := crc16(payload)
	return payload + fmt.Sprintf("%04X", crc), nil
}

func tlv(id, value string) string {
	return fmt.Sprintf("%s%02d%s", id, len(value), value)
}

func sanitizeTXID(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		out = "PDV"
	}
	if len(out) > 25 {
		out = out[:25]
	}
	return out
}

func crc16(payload string) uint16 {
	var crc uint16 = 0xFFFF
	for i := 0; i < len(payload); i++ {
		crc ^= uint16(payload[i]) << 8
		for j := 0; j < 8; j++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}
