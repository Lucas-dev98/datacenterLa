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
	WarehouseID   uuid.UUID  `json:"warehouse_id,omitempty"`
	LocationID    *uuid.UUID `json:"location_id,omitempty"`
	Status        UnitStatus `json:"status"`
	PurchaseID    *uuid.UUID `json:"purchase_id,omitempty"`
	UnitCostUSD   *float64   `json:"unit_cost_usd,omitempty"`
	ReceivedAt    *time.Time `json:"received_at,omitempty"`
	AvailableAt   *time.Time `json:"available_at,omitempty"`
	SoldAt        *time.Time `json:"sold_at,omitempty"`
	OrderID       *uuid.UUID `json:"order_id,omitempty"`
	OrderItemID   *uuid.UUID `json:"order_item_id,omitempty"`
	ReservationID *uuid.UUID `json:"reservation_id,omitempty"`
	SerialNumber  *string    `json:"serial_number,omitempty"`
	IntakeBatchID *uuid.UUID `json:"intake_batch_id,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	Version       int        `json:"-"`
	CreatedAt     time.Time  `json:"created_at,omitempty"`
	UpdatedAt     time.Time  `json:"updated_at,omitempty"`
}

type IntakePhotoUpload struct {
	Body []byte
	Ext  string
}

type UnitIntakePhoto struct {
	ID              uuid.UUID `json:"id"`
	InventoryUnitID uuid.UUID `json:"inventory_unit_id"`
	FilePath        string    `json:"-"`
	CreatedAt       time.Time `json:"created_at"`
}

type IntakeBatch struct {
	ID            uuid.UUID  `json:"id"`
	WarehouseID   uuid.UUID  `json:"warehouse_id"`
	SKUID         uuid.UUID  `json:"sku_id"`
	Quantity      int        `json:"quantity"`
	FirstUnitCode *string    `json:"first_unit_code,omitempty"`
	LastUnitCode  *string    `json:"last_unit_code,omitempty"`
	PurchaseID    *uuid.UUID `json:"purchase_id,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

type IntakeBatchPhoto struct {
	ID        uuid.UUID `json:"id"`
	BatchID   uuid.UUID `json:"batch_id"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

// UnitDetail enriches InventoryUnit with catalog data for lookup screens.
type UnitDetail struct {
	ID                   uuid.UUID  `json:"id"`
	UnitCode             string     `json:"unit_code"`
	SKUID                uuid.UUID  `json:"sku_id"`
	SKUCode              string     `json:"sku_code"`
	SKUName              string     `json:"sku_name"`
	ProductID            uuid.UUID  `json:"product_id"`
	ProductName          string     `json:"product_name"`
	ProductDescription   *string    `json:"product_description,omitempty"`
	Brand                *string    `json:"brand,omitempty"`
	CategoryName         *string    `json:"category_name,omitempty"`
	Status               UnitStatus `json:"status"`
	WarehouseID          uuid.UUID  `json:"warehouse_id"`
	UnitCostUSD          *float64   `json:"unit_cost_usd,omitempty"`
	ReceivedAt           *time.Time `json:"received_at,omitempty"`
	AvailableAt          *time.Time `json:"available_at,omitempty"`
	SoldAt               *time.Time `json:"sold_at,omitempty"`
	OrderID              *uuid.UUID `json:"order_id,omitempty"`
	PurchaseID           *uuid.UUID `json:"purchase_id,omitempty"`
	PONumber             *string    `json:"po_number,omitempty"`
	SerialNumber         *string    `json:"serial_number,omitempty"`
}

type StockBalance struct {
	SKUID        uuid.UUID
	WarehouseID  uuid.UUID
	QtyPhysical  int
	QtyReserved  int
	QtyAvailable int
	UpdatedAt    time.Time
}

type BalanceListItem struct {
	SKUID        uuid.UUID `json:"sku_id"`
	SKUCode      string    `json:"sku_code"`
	SKUName      string    `json:"sku_name"`
	WarehouseID  uuid.UUID `json:"warehouse_id"`
	QtyPhysical  int       `json:"qty_physical"`
	QtyReserved  int       `json:"qty_reserved"`
	QtyAvailable int       `json:"qty_available"`
}

type LowStockSKU struct {
	SKUID        uuid.UUID `json:"sku_id"`
	SKUCode      string    `json:"sku_code"`
	SKUName      string    `json:"sku_name"`
	QtyPhysical  int       `json:"qty_physical"`
	QtyReserved  int       `json:"qty_reserved"`
	QtyAvailable int       `json:"qty_available"`
}

type MovementListItem struct {
	ID              uuid.UUID    `json:"id"`
	MovementType    MovementType `json:"movement_type"`
	SKUID           uuid.UUID    `json:"sku_id"`
	SKUCode         string       `json:"sku_code"`
	SKUName         string       `json:"sku_name"`
	WarehouseID     uuid.UUID    `json:"warehouse_id"`
	InventoryUnitID *uuid.UUID   `json:"inventory_unit_id,omitempty"`
	UnitCode        *string      `json:"unit_code,omitempty"`
	Quantity        int          `json:"quantity"`
	StatusBefore    *UnitStatus  `json:"status_before,omitempty"`
	StatusAfter     *UnitStatus  `json:"status_after,omitempty"`
	ReferenceType   *string      `json:"reference_type,omitempty"`
	ReferenceID     *uuid.UUID   `json:"reference_id,omitempty"`
	Reason          *string      `json:"reason,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
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
	SKUID        uuid.UUID           `json:"sku_id"`
	Quantity     int                 `json:"quantity"`
	UnitCostUSD  *float64            `json:"unit_cost_usd,omitempty"`
	SerialNumber *string             `json:"serial_number,omitempty"`
	PurchaseID   *uuid.UUID          `json:"purchase_id,omitempty"`
	Units        []ReceiveUnitDetail `json:"units,omitempty"`
}

type ReceiveUnitDetail struct {
	SerialNumber string `json:"serial_number"`
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
	UnitCostUSD   *float64   `json:"unit_cost_usd,omitempty"`
	ReceivedAt    *time.Time `json:"received_at,omitempty"`
	SerialNumber  *string    `json:"serial_number,omitempty"`
	IntakeBatchID *uuid.UUID `json:"intake_batch_id,omitempty"`
	BatchPhotoCount int        `json:"batch_photo_count"`
	HasIntakePhoto bool      `json:"has_intake_photo"`
	NextAction  string     `json:"next_action"`
}
