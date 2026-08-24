package domain

import (
	"time"

	"github.com/google/uuid"
)

type UnitStatus string

const (
	StatusReceived   UnitStatus = "received"
	StatusInspecting UnitStatus = "inspecting"
	StatusIdentified UnitStatus = "identified"
	StatusAvailable  UnitStatus = "available"
	StatusReserved   UnitStatus = "reserved"
	StatusPicking    UnitStatus = "picking"
	StatusSold       UnitStatus = "sold"
	StatusInTransit  UnitStatus = "in_transit"
	StatusReturned   UnitStatus = "returned"
	StatusWarranty   UnitStatus = "warranty"
	StatusRMA        UnitStatus = "rma"
	StatusDamaged    UnitStatus = "damaged"
	StatusBlocked    UnitStatus = "blocked"
	StatusWrittenOff UnitStatus = "written_off"
)

type MovementType string

const (
	MovementPurchaseIn  MovementType = "purchase_in"
	MovementReturnIn    MovementType = "return_in"
	MovementTransferIn  MovementType = "transfer_in"
	MovementAdjustmentIn MovementType = "adjustment_in"
	MovementSaleOut     MovementType = "sale_out"
	MovementTransferOut MovementType = "transfer_out"
	MovementSupplierReturn MovementType = "supplier_return"
	MovementDamageOut   MovementType = "damage_out"
	MovementAdjustmentOut MovementType = "adjustment_out"
	MovementReserve     MovementType = "reserve"
	MovementRelease     MovementType = "release"
	MovementStatusChange MovementType = "status_change"
	MovementReversal    MovementType = "reversal"
)

type ReservationStatus string

const (
	ReservationActive    ReservationStatus = "active"
	ReservationFulfilled ReservationStatus = "fulfilled"
	ReservationReleased  ReservationStatus = "released"
	ReservationExpired   ReservationStatus = "expired"
)

type InventoryUnit struct {
	ID            uuid.UUID  `json:"id"`
	UnitCode      string     `json:"unit_code"` // AAA0001
	SKUID         uuid.UUID  `json:"sku_id"`
	WarehouseID   uuid.UUID
	LocationID    *uuid.UUID
	Status        UnitStatus
	PurchaseID    *uuid.UUID
	UnitCostUSD   *float64
	ReceivedAt    *time.Time
	AvailableAt   *time.Time
	SoldAt        *time.Time
	OrderID       *uuid.UUID
	OrderItemID   *uuid.UUID
	ReservationID *uuid.UUID
	SerialNumber  *string
	Notes         *string
	Version       int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type StockBalance struct {
	SKUID        uuid.UUID
	WarehouseID  uuid.UUID
	QtyPhysical  int
	QtyReserved  int
	QtyAvailable int
	UpdatedAt    time.Time
}

type StockMovement struct {
	ID              uuid.UUID
	MovementType    MovementType
	SKUID           uuid.UUID
	WarehouseID     uuid.UUID
	InventoryUnitID *uuid.UUID
	Quantity        int
	StatusBefore    *UnitStatus
	StatusAfter     *UnitStatus
	ReferenceType   *string
	ReferenceID     *uuid.UUID
	Reason          *string
	CreatedBy       uuid.UUID
	IdempotencyKey  *string
	CreatedAt       time.Time
}

type StockReservation struct {
	ID              uuid.UUID
	OrderID         uuid.UUID
	OrderItemID     uuid.UUID
	SKUID           uuid.UUID
	WarehouseID     uuid.UUID
	InventoryUnitID *uuid.UUID
	Quantity        int
	Status          ReservationStatus
	ExpiresAt       time.Time
	CreatedAt       time.Time
}

type ReceiveItemInput struct {
	SKUID        uuid.UUID  `json:"sku_id"`
	Quantity     int        `json:"quantity"`
	UnitCostUSD  *float64   `json:"unit_cost_usd,omitempty"`
	SerialNumber *string    `json:"serial_number,omitempty"`
	PurchaseID   *uuid.UUID `json:"purchase_id,omitempty"`
}

type ReserveItemInput struct {
	OrderItemID uuid.UUID `json:"order_item_id"`
	SKUID       uuid.UUID `json:"sku_id"`
	WarehouseID uuid.UUID `json:"warehouse_id"`
	Quantity    int       `json:"quantity"`
}

type Availability struct {
	SKUID        uuid.UUID `json:"sku_id"`
	WarehouseID  uuid.UUID `json:"warehouse_id"`
	QtyPhysical  int       `json:"qty_physical"`
	QtyReserved  int       `json:"qty_reserved"`
	QtyAvailable int       `json:"qty_available"`
}

// IntakeQueueItem is a unit awaiting inspection / identification / release.
type IntakeQueueItem struct {
	ID          uuid.UUID  `json:"id"`
	UnitCode    string     `json:"unit_code"`
	SKUID       uuid.UUID  `json:"sku_id"`
	SKUCode     string     `json:"sku_code"`
	SKUName     string     `json:"sku_name,omitempty"`
	WarehouseID uuid.UUID  `json:"warehouse_id"`
	Status      UnitStatus `json:"status"`
	PurchaseID  *uuid.UUID `json:"purchase_id,omitempty"`
	PONumber    *string    `json:"po_number,omitempty"`
	UnitCostUSD *float64   `json:"unit_cost_usd,omitempty"`
	ReceivedAt  *time.Time `json:"received_at,omitempty"`
	NextAction  string     `json:"next_action"`
}
