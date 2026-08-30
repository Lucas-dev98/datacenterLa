package domain

import (
	"time"

	"github.com/google/uuid"
)

type IntakeTestPhoto struct {
	ID              uuid.UUID `json:"id"`
	InventoryUnitID uuid.UUID `json:"inventory_unit_id"`
	FilePath        string    `json:"file_path"`
	CreatedAt       time.Time `json:"created_at"`
}

type SupplierReturnRequest struct {
	ID              uuid.UUID  `json:"id"`
	SupplierID      uuid.UUID  `json:"supplier_id"`
	SupplierName    string     `json:"supplier_name,omitempty"`
	PurchaseOrderID *uuid.UUID `json:"purchase_order_id,omitempty"`
	PONumber        string     `json:"po_number,omitempty"`
	InventoryUnitID uuid.UUID  `json:"inventory_unit_id"`
	UnitCode        string     `json:"unit_code,omitempty"`
	SKUID           uuid.UUID  `json:"sku_id"`
	SKUCode         string     `json:"sku_code,omitempty"`
	Reason          string     `json:"reason"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
}
