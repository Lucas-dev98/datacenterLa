package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrReturnWindowExpired = errors.New("prazo para devolução expirado")

type CustomerReturn struct {
	ID                uuid.UUID            `json:"id"`
	ReturnNumber      string               `json:"return_number"`
	OrderID           uuid.UUID            `json:"order_id"`
	OrderNumber       string               `json:"order_number,omitempty"`
	CustomerID        uuid.UUID            `json:"customer_id"`
	CustomerName      string               `json:"customer_name,omitempty"`
	Status            string               `json:"status"`
	Reason            string               `json:"reason"`
	ConditionNotes    *string              `json:"condition_notes,omitempty"`
	ReturnWindowDays  int                  `json:"return_window_days,omitempty"`
	ReturnExpiresAt   *time.Time           `json:"return_expires_at,omitempty"`
	WithinReturnWindow bool                `json:"within_return_window"`
	Resolution        *string              `json:"resolution,omitempty"`
	Notes             *string              `json:"notes,omitempty"`
	RequestedBy       *uuid.UUID           `json:"requested_by,omitempty"`
	ApprovedBy        *uuid.UUID           `json:"approved_by,omitempty"`
	Items             []CustomerReturnItem `json:"items,omitempty"`
	Photos            []CustomerReturnPhoto `json:"photos,omitempty"`
	CreatedAt         time.Time            `json:"created_at"`
	UpdatedAt         time.Time            `json:"updated_at"`
}

type CustomerReturnPhoto struct {
	ID        uuid.UUID `json:"id"`
	ReturnID  uuid.UUID `json:"return_id"`
	CreatedAt time.Time `json:"created_at"`
}

type CustomerReturnItem struct {
	ID              uuid.UUID  `json:"id"`
	ReturnID        uuid.UUID  `json:"return_id"`
	OrderItemID     *uuid.UUID `json:"order_item_id,omitempty"`
	SKUID           uuid.UUID  `json:"sku_id"`
	SKUCode         string     `json:"sku_code,omitempty"`
	InventoryUnitID *uuid.UUID `json:"inventory_unit_id,omitempty"`
	Quantity        int        `json:"quantity"`
	ConditionNotes  *string    `json:"condition_notes,omitempty"`
}

type ReturnPhotoUpload struct {
	Body []byte
	Ext  string
}

type CreateCustomerReturnInput struct {
	OrderID        uuid.UUID
	Reason         string
	ConditionNotes *string
	Notes          *string
	RequestedBy    uuid.UUID
	Items          []CreateReturnItemInput
	Photos         []ReturnPhotoUpload
}

type CreateReturnItemInput struct {
	OrderItemID     *uuid.UUID `json:"order_item_id,omitempty"`
	SKUID           uuid.UUID  `json:"sku_id"`
	InventoryUnitID *uuid.UUID `json:"inventory_unit_id,omitempty"`
	Quantity        int        `json:"quantity"`
	ConditionNotes  *string    `json:"condition_notes,omitempty"`
}
