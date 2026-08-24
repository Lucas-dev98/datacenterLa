package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
)

const TaxRateParaguay = 0.10

type SKUPrice struct {
	SKUID            uuid.UUID  `json:"sku_id"`
	CostUSD          *float64   `json:"cost_usd,omitempty"`
	MinPriceUSD      *float64   `json:"min_price_usd,omitempty"`
	PriceB2CUSD      *float64   `json:"price_b2c_usd,omitempty"`
	PriceB2BUSD      *float64   `json:"price_b2b_usd,omitempty"`
	PriceResellerUSD *float64   `json:"price_reseller_usd,omitempty"`
	PricePromoUSD    *float64   `json:"price_promo_usd,omitempty"`
	PromoStartsAt    *time.Time `json:"promo_starts_at,omitempty"`
	PromoEndsAt      *time.Time `json:"promo_ends_at,omitempty"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type UpsertPriceInput struct {
	CostUSD          *float64   `json:"cost_usd,omitempty"`
	MinPriceUSD      *float64   `json:"min_price_usd,omitempty"`
	PriceB2CUSD      *float64   `json:"price_b2c_usd,omitempty"`
	PriceB2BUSD      *float64   `json:"price_b2b_usd,omitempty"`
	PriceResellerUSD *float64   `json:"price_reseller_usd,omitempty"`
	PricePromoUSD    *float64   `json:"price_promo_usd,omitempty"`
	PromoStartsAt    *time.Time `json:"promo_starts_at,omitempty"`
	PromoEndsAt      *time.Time `json:"promo_ends_at,omitempty"`
}

type ResolvedPrice struct {
	SKUID                uuid.UUID `json:"sku_id"`
	Channel              string    `json:"channel"`
	BasePriceUSD         float64   `json:"base_price_usd"`
	PriceWithIVA         float64   `json:"price_with_iva_usd"`
	PricePYG             float64   `json:"price_pyg,omitempty"`
	PriceWithIVAPYG      float64   `json:"price_with_iva_pyg,omitempty"`
	ExchangeRateUSDToPYG float64   `json:"exchange_rate_usd_pyg,omitempty"`
	PromoApplied         bool      `json:"promo_applied"`
}
