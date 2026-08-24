package domain

import "github.com/google/uuid"

// WalkInCustomerID is the default B2C customer for in-store POS sales.
var WalkInCustomerID = uuid.MustParse("77777777-7777-7777-7777-777777777001")

type POSCheckoutInput struct {
	CustomerID      *uuid.UUID   `json:"customer_id,omitempty"`
	WarehouseID     uuid.UUID    `json:"warehouse_id"`
	Items           []LineInput  `json:"items"`
	Payment         PaymentInput `json:"payment"`
	ShipImmediately bool         `json:"ship_immediately"`
	DiscountPct     float64      `json:"discount_pct"`
}

// POSPixInitInput creates a confirmed store order and returns a PIX charge (QR + copia e cola).
type POSPixInitInput struct {
	CustomerID  *uuid.UUID  `json:"customer_id,omitempty"`
	WarehouseID uuid.UUID   `json:"warehouse_id"`
	Items       []LineInput `json:"items"`
	DiscountPct float64     `json:"discount_pct"`
}

type POSPixInitResponse struct {
	Order           Order   `json:"order"`
	AmountBRL       float64 `json:"amount_brl"`
	BRLRate         float64 `json:"brl_rate"`
	CopyPaste       string  `json:"copy_paste"`
	QRCodePNGBase64 string  `json:"qr_png_base64"`
	TXID            string  `json:"txid"`
	DevMode         bool    `json:"dev_mode,omitempty"`
}

type POSPixConfirmInput struct {
	Reference       *string `json:"reference,omitempty"`
	ShipImmediately bool    `json:"ship_immediately"`
}
