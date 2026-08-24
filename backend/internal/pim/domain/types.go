package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrInvalidInput  = errors.New("invalid input")
	ErrConflict      = errors.New("conflict")
	ErrDuplicate     = errors.New("duplicate")
	ErrHasDependents = errors.New("has dependents")
)

type Category struct {
	ID        uuid.UUID  `json:"id"`
	Code      string     `json:"code"`
	Name      string     `json:"name"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CategoryAttribute struct {
	ID         uuid.UUID `json:"id"`
	CategoryID uuid.UUID `json:"category_id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	DataType   string    `json:"data_type"`
	IsRequired bool      `json:"is_required"`
	SortOrder  int       `json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
}

type Product struct {
	ID                   uuid.UUID  `json:"id"`
	Name                 string     `json:"name"`
	CategoryID           *uuid.UUID `json:"category_id,omitempty"`
	Description          *string    `json:"description,omitempty"`
	GeneratedDescription *string    `json:"generated_description,omitempty"`
	NameES               *string    `json:"name_es,omitempty"`
	DescriptionES        *string    `json:"description_es,omitempty"`
	GeneratedDescriptionES *string  `json:"generated_description_es,omitempty"`
	Brand                *string    `json:"brand,omitempty"`
	Manufacturer         *string    `json:"manufacturer,omitempty"`
	IsActive             bool       `json:"is_active"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	Attributes           []ProductAttributeValue `json:"attributes,omitempty"`
	SKUs                 []SKU      `json:"skus,omitempty"`
}

type ProductAttributeValue struct {
	ID                  uuid.UUID `json:"id"`
	ProductID           uuid.UUID `json:"product_id"`
	CategoryAttributeID uuid.UUID `json:"category_attribute_id"`
	AttributeCode       string    `json:"attribute_code,omitempty"`
	AttributeName       string    `json:"attribute_name,omitempty"`
	DataType            string    `json:"data_type,omitempty"`
	ValueText           *string   `json:"value_text,omitempty"`
	ValueNumber         *float64  `json:"value_number,omitempty"`
	ValueBoolean        *bool     `json:"value_boolean,omitempty"`
}

type SKU struct {
	ID                     uuid.UUID  `json:"id"`
	ProductID              *uuid.UUID `json:"product_id,omitempty"`
	Code                   string     `json:"code"` // SKU numérico 6 dígitos
	Name                   string     `json:"name"`
	Description            *string    `json:"description,omitempty"`
	ImageURL               *string    `json:"image_url,omitempty"`
	IsActive               bool       `json:"is_active"`
	PublishComprasParaguai bool       `json:"publish_compras_paraguai"`
	PublishEcommerce       bool       `json:"publish_ecommerce"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

type ListFilter struct {
	Query      string
	CategoryID *uuid.UUID
	ProductID  *uuid.UUID
	ActiveOnly bool
	Limit      int
	Offset     int
}

type ListResult[T any] struct {
	Items  []T `json:"items"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

type CreateProductInput struct {
	Name         string                 `json:"name"`
	CategoryID   *uuid.UUID             `json:"category_id,omitempty"`
	Description  *string                `json:"description,omitempty"`
	Brand        *string                `json:"brand,omitempty"`
	Manufacturer *string                `json:"manufacturer,omitempty"`
	NameES               *string          `json:"name_es,omitempty"`
	DescriptionES        *string          `json:"description_es,omitempty"`
	GeneratedDescriptionES *string        `json:"generated_description_es,omitempty"`
	Attributes   []AttributeValueInput  `json:"attributes,omitempty"`
}

type UpdateProductInput struct {
	Name         *string                `json:"name,omitempty"`
	CategoryID   *uuid.UUID             `json:"category_id,omitempty"`
	Description  *string                `json:"description,omitempty"`
	Brand        *string                `json:"brand,omitempty"`
	Manufacturer *string                `json:"manufacturer,omitempty"`
	NameES               *string          `json:"name_es,omitempty"`
	DescriptionES        *string          `json:"description_es,omitempty"`
	GeneratedDescriptionES *string        `json:"generated_description_es,omitempty"`
	IsActive     *bool                  `json:"is_active,omitempty"`
	Attributes   []AttributeValueInput  `json:"attributes,omitempty"`
}

type AttributeValueInput struct {
	CategoryAttributeID uuid.UUID `json:"category_attribute_id"`
	ValueText           *string   `json:"value_text,omitempty"`
	ValueNumber         *float64  `json:"value_number,omitempty"`
	ValueBoolean        *bool     `json:"value_boolean,omitempty"`
}

type CreateSKUInput struct {
	ProductID              uuid.UUID `json:"product_id"`
	Name                   string    `json:"name"`
	Description            *string   `json:"description,omitempty"`
	PublishComprasParaguai bool      `json:"publish_compras_paraguai"`
	PublishEcommerce       bool      `json:"publish_ecommerce"`
}

type UpdateSKUInput struct {
	Name                   *string `json:"name,omitempty"`
	Description            *string `json:"description,omitempty"`
	IsActive               *bool   `json:"is_active,omitempty"`
	PublishComprasParaguai *bool   `json:"publish_compras_paraguai,omitempty"`
	PublishEcommerce       *bool   `json:"publish_ecommerce,omitempty"`
	ImageURL               *string `json:"image_url,omitempty"`
}

type CreateCategoryInput struct {
	Code     string     `json:"code"`
	Name     string     `json:"name"`
	ParentID *uuid.UUID `json:"parent_id,omitempty"`
}

type UpdateCategoryInput struct {
	Name     *string    `json:"name,omitempty"`
	ParentID *uuid.UUID `json:"parent_id,omitempty"`
	IsActive *bool      `json:"is_active,omitempty"`
}

type CreateCategoryAttributeInput struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	DataType   string `json:"data_type"`
	IsRequired bool   `json:"is_required"`
	SortOrder  int    `json:"sort_order"`
}
