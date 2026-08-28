package domain

import (
	"time"

	"github.com/google/uuid"
)

type RMACase struct {
	ID                uuid.UUID      `json:"id"`
	CaseNumber        string         `json:"case_number"`
	OrderID           uuid.UUID      `json:"order_id"`
	OrderNumber       string         `json:"order_number,omitempty"`
	CustomerID        uuid.UUID      `json:"customer_id"`
	CustomerName      string         `json:"customer_name,omitempty"`
	Status            string         `json:"status"`
	Reason            string         `json:"reason"`
	TestNotes         *string        `json:"test_notes,omitempty"`
	DefectConfirmed   bool           `json:"defect_confirmed"`
	TestSubmittedAt   *time.Time     `json:"test_submitted_at,omitempty"`
	TestSubmittedBy   *uuid.UUID     `json:"test_submitted_by,omitempty"`
	WarrantyDays      int            `json:"warranty_days,omitempty"`
	WarrantyExpiresAt *time.Time     `json:"warranty_expires_at,omitempty"`
	WithinWarranty    bool           `json:"within_warranty"`
	Resolution        *string        `json:"resolution,omitempty"`
	Notes             *string        `json:"notes,omitempty"`
	RequestedBy       *uuid.UUID     `json:"requested_by,omitempty"`
	ApprovedBy        *uuid.UUID     `json:"approved_by,omitempty"`
	Items             []RMAItem      `json:"items,omitempty"`
	TestPhotos        []RMATestPhoto `json:"test_photos,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type RMATestPhoto struct {
	ID        uuid.UUID `json:"id"`
	RMACaseID uuid.UUID `json:"rma_case_id"`
	CreatedAt time.Time `json:"created_at"`
}

type RMAItem struct {
	ID              uuid.UUID  `json:"id"`
	RMACaseID       uuid.UUID  `json:"rma_case_id"`
	OrderItemID     *uuid.UUID `json:"order_item_id,omitempty"`
	SKUID           uuid.UUID  `json:"sku_id"`
	SKUCode         string     `json:"sku_code,omitempty"`
	InventoryUnitID *uuid.UUID `json:"inventory_unit_id,omitempty"`
	Quantity        int        `json:"quantity"`
	ConditionNotes  *string    `json:"condition_notes,omitempty"`
}

type RMATestPhotoUpload struct {
	Body []byte
	Ext  string
}

type CreateRMAInput struct {
	OrderID         uuid.UUID
	Reason          string
	TestNotes       string
	DefectConfirmed bool
	Notes           *string
	RequestedBy     uuid.UUID
	Items           []CreateRMAItemInput
	TestPhotos      []RMATestPhotoUpload
}

type CreateRMAItemInput struct {
	OrderItemID     *uuid.UUID `json:"order_item_id,omitempty"`
	SKUID           uuid.UUID  `json:"sku_id"`
	InventoryUnitID *uuid.UUID `json:"inventory_unit_id,omitempty"`
	Quantity        int        `json:"quantity"`
	ConditionNotes  *string    `json:"condition_notes,omitempty"`
}
