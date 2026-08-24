package pix

import (
	"encoding/base64"
	"fmt"

	"github.com/datacenterla/platform/internal/platform/labels"
)

type Charge struct {
	CopyPaste       string  `json:"copy_paste"`
	QRCodePNGBase64 string  `json:"qr_png_base64"`
	AmountBRL       float64 `json:"amount_brl"`
	TXID            string  `json:"txid"`
	DevMode         bool    `json:"dev_mode,omitempty"`
}

func BuildCharge(cfg Config, amountBRL float64, txid string) (*Charge, error) {
	envCfg := ConfigFromEnv()
	devMode := !envCfg.Ready()
	if devMode {
		cfg = Config{
			Key:          "dev@datacenterla.local",
			MerchantName: envCfg.MerchantName,
			MerchantCity: envCfg.MerchantCity,
		}
	}
	copyPaste, err := DynamicCharge(cfg, amountBRL, txid)
	if err != nil {
		return nil, err
	}
	png, err := labels.GeneratePNG(copyPaste, 280)
	if err != nil {
		return nil, fmt.Errorf("qr png: %w", err)
	}
	return &Charge{
		CopyPaste:       copyPaste,
		QRCodePNGBase64: base64.StdEncoding.EncodeToString(png),
		AmountBRL:       amountBRL,
		TXID:            sanitizeTXID(txid),
		DevMode:         devMode,
	}, nil
}
