package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type HealthDashboard struct {
	TotalUnits           int `json:"total_units"`
	AvailableUnits       int `json:"available_units"`
	ReservedUnits        int `json:"reserved_units"`
	OpenIssues           int `json:"open_issues"`
	ExpiringReservations int `json:"expiring_reservations"`
	LowStockSKUs         int `json:"low_stock_skus"`
	UnitsByStatus        map[string]int `json:"units_by_status"`
}

type ExpiringReservation struct {
	ID          uuid.UUID  `json:"id"`
	OrderID     uuid.UUID  `json:"order_id"`
	OrderNumber *string    `json:"order_number,omitempty"`
	SKUID       uuid.UUID  `json:"sku_id"`
	SKUCode     string     `json:"sku_code"`
	ExpiresAt   time.Time  `json:"expires_at"`
}

type HealthIssue struct {
	ID              uuid.UUID       `json:"id"`
	IssueType       string          `json:"issue_type"`
	Status          string          `json:"status"`
	InventoryUnitID *uuid.UUID      `json:"inventory_unit_id,omitempty"`
	UnitCode        *string         `json:"unit_code,omitempty"`
	SKUID           *uuid.UUID      `json:"sku_id,omitempty"`
	SKUCode         *string         `json:"sku_code,omitempty"`
	WarehouseID     *uuid.UUID      `json:"warehouse_id,omitempty"`
	Details         json.RawMessage `json:"details"`
	DetectedAt      time.Time       `json:"detected_at"`
	ResolvedAt      *time.Time      `json:"resolved_at,omitempty"`
	ResolutionNotes *string         `json:"resolution_notes,omitempty"`
}

type StockCount struct {
	ID          uuid.UUID  `json:"id"`
	WarehouseID uuid.UUID  `json:"warehouse_id"`
	CountType   string     `json:"count_type"`
	Status      string     `json:"status"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedBy   uuid.UUID  `json:"created_by"`
	ApprovedBy  *uuid.UUID `json:"approved_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	Lines       []StockCountLine `json:"lines,omitempty"`
}

type StockCountLine struct {
	ID              uuid.UUID  `json:"id"`
	SKUID           *uuid.UUID `json:"sku_id,omitempty"`
	SKUCode         *string    `json:"sku_code,omitempty"`
	InventoryUnitID *uuid.UUID `json:"inventory_unit_id,omitempty"`
	UnitCode        *string    `json:"unit_code,omitempty"`
	SystemQty       int        `json:"system_qty"`
	CountedQty      *int       `json:"counted_qty,omitempty"`
	Variance        int        `json:"variance"`
	Status          string     `json:"status"`
}

type StockAdjustment struct {
	ID                uuid.UUID  `json:"id"`
	WarehouseID       uuid.UUID  `json:"warehouse_id"`
	SKUID             *uuid.UUID `json:"sku_id,omitempty"`
	SKUCode           *string    `json:"sku_code,omitempty"`
	QuantityDelta     int        `json:"quantity_delta"`
	EstimatedValueUSD *float64   `json:"estimated_value_usd,omitempty"`
	Reason            string     `json:"reason"`
	Status            string     `json:"status"`
	StockCountID      *uuid.UUID `json:"stock_count_id,omitempty"`
	RequestedBy       uuid.UUID  `json:"requested_by"`
	ApprovedBy        *uuid.UUID `json:"approved_by,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type CreateCountInput struct {
	WarehouseID uuid.UUID
	CountType   string
	CreatedBy   uuid.UUID
}

type CountLineInput struct {
	SKUID      *uuid.UUID `json:"sku_id,omitempty"`
	UnitCode   *string    `json:"unit_code,omitempty"`
	CountedQty int        `json:"counted_qty"`
}

type CreateAdjustmentInput struct {
	WarehouseID       uuid.UUID
	SKUID             uuid.UUID
	QuantityDelta     int
	EstimatedValueUSD *float64
	Reason            string
	RequestedBy       uuid.UUID
}
