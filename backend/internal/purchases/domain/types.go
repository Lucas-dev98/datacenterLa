package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrInvalidInput   = errors.New("invalid input")
	ErrInvalidState   = errors.New("invalid state")
	ErrInvalidImport  = errors.New("invalid import configuration")
)

type Supplier struct {
	ID          uuid.UUID `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	LegalName   *string   `json:"legal_name,omitempty"`
	Email       *string   `json:"email,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	DocumentID  *string   `json:"document_id,omitempty"`
	Country     string    `json:"country"`
	Kind        string    `json:"kind"`
	HoldingCode *string   `json:"holding_code,omitempty"`
	Status      string    `json:"status"`
	Notes       *string   `json:"notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PurchaseOrder struct {
	ID                      uuid.UUID           `json:"id"`
	PONumber                string              `json:"po_number"`
	SupplierID              uuid.UUID           `json:"supplier_id"`
	SupplierName            string              `json:"supplier_name,omitempty"`
	SupplierKind            string              `json:"supplier_kind,omitempty"`
	WarehouseID             uuid.UUID           `json:"warehouse_id"`
	Status                  string              `json:"status"`
	ImportOrigin            string              `json:"import_origin"`
	IntercompanyInvoiceRef  *string             `json:"intercompany_invoice_ref,omitempty"`
	CustomsDeclarationRef   *string             `json:"customs_declaration_ref,omitempty"`
	Incoterms               *string             `json:"incoterms,omitempty"`
	FreightUSD              float64             `json:"freight_usd"`
	DutiesUSD               float64             `json:"duties_usd"`
	LandedCostUSD           float64             `json:"landed_cost_usd,omitempty"`
	OriginCountryCode       *string             `json:"origin_country_code,omitempty"`
	Payable                 *POPayableSummary   `json:"payable,omitempty"`
	ExpectedAt              *time.Time          `json:"expected_at,omitempty"`
	Notes                   *string             `json:"notes,omitempty"`
	CreatedBy               uuid.UUID           `json:"created_by"`
	OrderedAt               *time.Time          `json:"ordered_at,omitempty"`
	ReceivedAt              *time.Time          `json:"received_at,omitempty"`
	Items                   []PurchaseOrderItem `json:"items,omitempty"`
	CreatedAt               time.Time           `json:"created_at"`
	UpdatedAt               time.Time           `json:"updated_at"`
}

type PurchaseOrderItem struct {
	ID               uuid.UUID `json:"id"`
	PurchaseOrderID  uuid.UUID `json:"purchase_order_id"`
	SKUID            uuid.UUID `json:"sku_id"`
	SKUCode          string    `json:"sku_code,omitempty"`
	QuantityOrdered  int       `json:"quantity_ordered"`
	QuantityReceived int       `json:"quantity_received"`
	UnitCostUSD      float64 `json:"unit_cost_usd"`
	UnitLandedCostUSD float64 `json:"unit_landed_cost_usd,omitempty"`
}

type POPayableSummary struct {
	ID            uuid.UUID `json:"id"`
	Status        string    `json:"status"`
	AmountUSD     float64   `json:"amount_usd"`
	AmountPaidUSD float64   `json:"amount_paid_usd"`
}

type UpdateSupplierInput struct {
	Name        string  `json:"name"`
	LegalName   *string `json:"legal_name,omitempty"`
	Email       *string `json:"email,omitempty"`
	Phone       *string `json:"phone,omitempty"`
	DocumentID  *string `json:"document_id,omitempty"`
	Country     string  `json:"country"`
	Kind        string  `json:"kind"`
	HoldingCode *string `json:"holding_code,omitempty"`
	Notes       *string `json:"notes,omitempty"`
}

type CreateSupplierInput struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	LegalName   *string `json:"legal_name,omitempty"`
	Email       *string `json:"email,omitempty"`
	Phone       *string `json:"phone,omitempty"`
	DocumentID  *string `json:"document_id,omitempty"`
	Country     string  `json:"country"`
	Kind        string  `json:"kind"`
	HoldingCode *string `json:"holding_code,omitempty"`
	Notes       *string `json:"notes,omitempty"`
}

type CreatePOItemInput struct {
	SKUID       uuid.UUID `json:"sku_id"`
	Quantity    int       `json:"quantity"`
	UnitCostUSD float64   `json:"unit_cost_usd"`
}

type CreatePOInput struct {
	SupplierID             uuid.UUID           `json:"supplier_id"`
	WarehouseID            uuid.UUID           `json:"warehouse_id"`
	ImportOrigin           string              `json:"import_origin"`
	IntercompanyInvoiceRef *string             `json:"intercompany_invoice_ref,omitempty"`
	CustomsDeclarationRef  *string             `json:"customs_declaration_ref,omitempty"`
	Incoterms              *string             `json:"incoterms,omitempty"`
	FreightUSD             float64             `json:"freight_usd"`
	DutiesUSD              float64             `json:"duties_usd"`
	OriginCountryCode      *string             `json:"origin_country_code,omitempty"`
	ExpectedAt             *string             `json:"expected_at,omitempty"`
	Notes                  *string             `json:"notes,omitempty"`
	Items                  []CreatePOItemInput `json:"items"`
}

type ReceivePOItemInput struct {
	SKUID    uuid.UUID `json:"sku_id"`
	Quantity int       `json:"quantity"`
}

type ReceivePOInput struct {
	Items []ReceivePOItemInput `json:"items"`
}
