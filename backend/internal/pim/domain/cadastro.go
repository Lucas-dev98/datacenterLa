package domain

import (
	"github.com/datacenterla/platform/internal/platform/labels"
	"github.com/google/uuid"
)

type CreateCadastroInput struct {
	Name                   string                `json:"name"`
	CategoryID             uuid.UUID             `json:"category_id"`
	Description            *string               `json:"description,omitempty"`
	Brand                  *string               `json:"brand,omitempty"`
	Manufacturer           *string               `json:"manufacturer,omitempty"`
	NameES                 *string               `json:"name_es,omitempty"`
	DescriptionES          *string               `json:"description_es,omitempty"`
	GeneratedDescriptionES *string               `json:"generated_description_es,omitempty"`
	Attributes             []AttributeValueInput `json:"attributes,omitempty"`
	PublishComprasParaguai bool                  `json:"publish_compras_paraguai"`
	PublishEcommerce       bool                  `json:"publish_ecommerce"`
}

type CadastroResult struct {
	Product *Product `json:"product"`
	SKU     *SKU     `json:"sku"`
	Label   labels.CadastroLabel `json:"label"`
}

type CadastroLabelData struct {
	SKUCode              string
	ProductID            uuid.UUID
	GeneratedDescription *string
	Brand                *string
	CategoryName         *string
	AttributeValues      []string
}
