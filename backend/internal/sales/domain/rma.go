package domain

import (
	"time"

	"github.com/google/uuid"
)

type RMACase struct {
	ID          uuid.UUID  `json:"id"`
	CaseNumber  string     `json:"case_number"`
	OrderID     uuid.UUID  `json:"order_id"`
	OrderNumber string     `json:"order_number,omitempty"`
	CustomerID  uuid.UUID  `json:"customer_id"`
	CustomerName string    `json:"customer_name,omitempty"`
	Status      string     `json:"status"`
	Reason      string     `json:"reason"`
	Resolution  *string    `json:"resolution,omitempty"`
	Notes       *string    `json:"notes,omitempty"`
	RequestedBy *uuid.UUID `json:"requested_by,omitempty"`
	ApprovedBy  *uuid.UUID `json:"approved_by,omitempty"`
	Items       []RMAItem  `json:"items,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
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

type CreateRMAInput struct {
	OrderID     uuid.UUID
	Reason      string
	Notes       *string
	RequestedBy uuid.UUID
	Items       []CreateRMAItemInput
}

type CreateRMAItemInput struct {
	OrderItemID     *uuid.UUID `json:"order_item_id,omitempty"`
	SKUID           uuid.UUID  `json:"sku_id"`
	InventoryUnitID *uuid.UUID `json:"inventory_unit_id,omitempty"`
	Quantity        int        `json:"quantity"`
	ConditionNotes  *string    `json:"condition_notes,omitempty"`
}
