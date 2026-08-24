package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidState       = errors.New("invalid state")
	ErrInsufficientCredit = errors.New("insufficient credit")
	ErrEmptyCart          = errors.New("carrinho vazio")
)

type Customer struct {
	ID               uuid.UUID `json:"id"`
	Type             string    `json:"type"`
	Name             string    `json:"name"`
	Email            *string   `json:"email,omitempty"`
	Phone            *string   `json:"phone,omitempty"`
	DocumentID       *string   `json:"document_id,omitempty"`
	CreditLimitUSD   float64   `json:"credit_limit_usd"`
	PaymentTermsDays int       `json:"payment_terms_days"`
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
}

type CreateCustomerInput struct {
	Type             string  `json:"type"`
	Name             string  `json:"name"`
	Email            *string `json:"email,omitempty"`
	Phone            *string `json:"phone,omitempty"`
	DocumentID       *string `json:"document_id,omitempty"`
	CreditLimitUSD   float64 `json:"credit_limit_usd"`
	PaymentTermsDays int     `json:"payment_terms_days"`
}

type QuoteListItem struct {
	ID           uuid.UUID `json:"id"`
	QuoteNumber  string    `json:"quote_number"`
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	Status       string    `json:"status"`
	Channel      string    `json:"channel"`
	TotalUSD     float64   `json:"total_usd"`
	CreatedAt    time.Time `json:"created_at"`
}

type Quote struct {
	ID          uuid.UUID   `json:"id"`
	QuoteNumber string      `json:"quote_number"`
	CustomerID  uuid.UUID   `json:"customer_id"`
	SellerID    uuid.UUID   `json:"seller_id"`
	Status      string      `json:"status"`
	Channel     string      `json:"channel"`
	ValidUntil  *time.Time  `json:"valid_until,omitempty"`
	DiscountPct float64     `json:"discount_pct"`
	Notes       *string     `json:"notes,omitempty"`
	Items       []QuoteItem `json:"items,omitempty"`
	TotalUSD    float64     `json:"total_usd"`
	CreatedAt   time.Time   `json:"created_at"`
}

type QuoteItem struct {
	ID           uuid.UUID `json:"id"`
	SKUID        uuid.UUID `json:"sku_id"`
	Quantity     int       `json:"quantity"`
	UnitPriceUSD float64   `json:"unit_price_usd"`
	DiscountPct  float64   `json:"discount_pct"`
	LineTotalUSD float64   `json:"line_total_usd"`
}

type OrderListItem struct {
	ID           uuid.UUID `json:"id"`
	OrderNumber  string    `json:"order_number"`
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	Status       string    `json:"status"`
	Channel      string    `json:"channel"`
	TotalUSD     float64   `json:"total_usd"`
	QuoteID      *uuid.UUID `json:"quote_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type Order struct {
	ID          uuid.UUID   `json:"id"`
	OrderNumber string      `json:"order_number"`
	CustomerID  uuid.UUID   `json:"customer_id"`
	QuoteID     *uuid.UUID  `json:"quote_id,omitempty"`
	SellerID    *uuid.UUID  `json:"seller_id,omitempty"`
	Channel     string      `json:"channel"`
	Status      string      `json:"status"`
	WarehouseID uuid.UUID   `json:"warehouse_id"`
	DiscountPct float64     `json:"discount_pct"`
	SubtotalUSD float64     `json:"subtotal_usd"`
	TotalUSD    float64     `json:"total_usd"`
	Items       []OrderItem `json:"items,omitempty"`
	ConfirmedAt *time.Time  `json:"confirmed_at,omitempty"`
	PaidAt      *time.Time  `json:"paid_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
}

type OrderItem struct {
	ID           uuid.UUID `json:"id"`
	SKUID        uuid.UUID `json:"sku_id"`
	SKUCode      string    `json:"sku_code,omitempty"`
	Quantity     int       `json:"quantity"`
	UnitPriceUSD float64   `json:"unit_price_usd"`
	DiscountPct  float64   `json:"discount_pct"`
	LineTotalUSD float64   `json:"line_total_usd"`
}

type LineInput struct {
	SKUID    uuid.UUID `json:"sku_id"`
	Quantity int       `json:"quantity"`
}

type CreateQuoteInput struct {
	CustomerID  uuid.UUID   `json:"customer_id"`
	SellerID    uuid.UUID   `json:"-"`
	Channel     string      `json:"channel"`
	DiscountPct float64     `json:"discount_pct"`
	Notes       *string     `json:"notes,omitempty"`
	Items       []LineInput `json:"items"`
}

type CreateOrderInput struct {
	CustomerID  uuid.UUID   `json:"customer_id"`
	SellerID    *uuid.UUID  `json:"-"`
	QuoteID     *uuid.UUID  `json:"quote_id,omitempty"`
	Channel     string      `json:"channel"`
	WarehouseID uuid.UUID   `json:"warehouse_id"`
	DiscountPct float64     `json:"discount_pct"`
	Items       []LineInput `json:"items"`
}

type PaymentInput struct {
	AmountUSD float64 `json:"amount_usd"`
	Method    string  `json:"method"`
	Reference *string `json:"reference"`
}

type Receivable struct {
	ID         uuid.UUID `json:"id"`
	OrderID    uuid.UUID `json:"order_id"`
	CustomerID uuid.UUID `json:"customer_id"`
	AmountUSD  float64   `json:"amount_usd"`
	PaidUSD    float64   `json:"paid_usd"`
	DueDate    string    `json:"due_date"`
	Status     string    `json:"status"`
}

type ReceivableListItem struct {
	Receivable
	CustomerName string `json:"customer_name"`
	OrderNumber  string `json:"order_number"`
}

type DashboardStats struct {
	OrdersDraft           int     `json:"orders_draft"`
	OrdersPendingShip     int     `json:"orders_pending_ship"`
	QuotesOpen            int     `json:"quotes_open"`
	ReceivablesOpen       int     `json:"receivables_open"`
	ReceivablesOutstandingUSD float64 `json:"receivables_outstanding_usd"`
	SkusLowStock          int     `json:"skus_low_stock"`
	ActiveSKUs            int     `json:"active_skus"`
}

type PendingOrderSummary struct {
	ID           uuid.UUID `json:"id"`
	OrderNumber  string    `json:"order_number"`
	CustomerName string    `json:"customer_name"`
	Status       string    `json:"status"`
	TotalUSD     float64   `json:"total_usd"`
	CreatedAt    time.Time `json:"created_at"`
}

type LowStockSKU struct {
	SKUCode      string `json:"sku_code"`
	Name         string `json:"name"`
	QtyAvailable int    `json:"qty_available"`
}

type EcommerceCategory struct {
	ID       uuid.UUID  `json:"id"`
	Code     string     `json:"code"`
	Name     string     `json:"name"`
	ParentID *uuid.UUID `json:"parent_id,omitempty"`
}

type Cart struct {
	ID        uuid.UUID  `json:"id"`
	SessionID string     `json:"session_id"`
	Items     []CartItem `json:"items"`
	ExpiresAt time.Time  `json:"expires_at"`
}

type CartItem struct {
	SKUID    uuid.UUID `json:"sku_id"`
	SKUCode  string    `json:"sku_code,omitempty"`
	Name     string    `json:"name,omitempty"`
	Quantity int       `json:"quantity"`
	PriceUSD float64   `json:"price_usd,omitempty"`
}

type CatalogProduct struct {
	SKUID                uuid.UUID  `json:"sku_id"`
	SKUCode              string     `json:"sku_code"`
	Name                 string     `json:"name"`
	Description          *string    `json:"description,omitempty"`
	CategoryID           *uuid.UUID `json:"category_id,omitempty"`
	CategoryName         *string    `json:"category_name,omitempty"`
	ImageURL             *string    `json:"image_url,omitempty"`
	PriceUSD             float64    `json:"price_usd"`
	PriceWithIVA         float64    `json:"price_with_iva_usd"`
	PricePYG             float64    `json:"price_pyg,omitempty"`
	PriceWithIVAPYG      float64    `json:"price_with_iva_pyg,omitempty"`
	ExchangeRateUSDToPYG float64    `json:"exchange_rate_usd_pyg,omitempty"`
	Available            int        `json:"available"`
}

type PublicOrderItem struct {
	SKUCode      string  `json:"sku_code"`
	SKUName      string  `json:"sku_name,omitempty"`
	Quantity     int     `json:"quantity"`
	UnitPriceUSD float64 `json:"unit_price_usd"`
	LineTotalUSD float64 `json:"line_total_usd"`
}

type PublicOrderSummary struct {
	ID           uuid.UUID         `json:"id"`
	OrderNumber  string            `json:"order_number"`
	Status       string            `json:"status"`
	StatusLabel  string            `json:"status_label"`
	TotalUSD     float64           `json:"total_usd"`
	CustomerName string            `json:"customer_name"`
	Items        []PublicOrderItem `json:"items,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
}

type Lead struct {
	ID         uuid.UUID  `json:"id"`
	Name       string     `json:"name"`
	Email      *string    `json:"email,omitempty"`
	Phone      *string    `json:"phone,omitempty"`
	Company    *string    `json:"company,omitempty"`
	Source     string     `json:"source"`
	Status     string     `json:"status"`
	Notes      *string    `json:"notes,omitempty"`
	OwnerID    *uuid.UUID `json:"owner_id,omitempty"`
	CustomerID *uuid.UUID `json:"customer_id,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type CreateLeadInput struct {
	Name    string     `json:"name"`
	Email   *string    `json:"email,omitempty"`
	Phone   *string    `json:"phone,omitempty"`
	Company *string    `json:"company,omitempty"`
	Source  string     `json:"source"`
	Notes   *string    `json:"notes,omitempty"`
	OwnerID *uuid.UUID `json:"owner_id,omitempty"`
}

type Payable struct {
	ID              uuid.UUID  `json:"id"`
	SupplierID      *uuid.UUID `json:"supplier_id,omitempty"`
	SupplierName    string     `json:"supplier_name,omitempty"`
	PurchaseOrderID *uuid.UUID `json:"purchase_order_id,omitempty"`
	PONumber        string     `json:"po_number,omitempty"`
	Description     string     `json:"description"`
	AmountUSD       float64    `json:"amount_usd"`
	AmountPaidUSD   float64    `json:"amount_paid_usd"`
	DueDate         *time.Time `json:"due_date,omitempty"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
}
