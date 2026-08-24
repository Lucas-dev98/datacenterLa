package service

import (
	"context"
	"strings"

	"github.com/datacenterla/platform/internal/pim/domain"
	"github.com/datacenterla/platform/internal/platform/labels"
	"github.com/google/uuid"
)

func (s *Service) productDescription(ctx context.Context, p *domain.Product, attrs []domain.ProductAttributeValue) (string, error) {
	if p.GeneratedDescription != nil && *p.GeneratedDescription != "" {
		return *p.GeneratedDescription, nil
	}
	categoryName := ""
	if p.CategoryID != nil {
		c, err := s.repo.GetCategory(ctx, *p.CategoryID)
		if err != nil {
			return "", err
		}
		categoryName = c.Name
	}
	values := attributeValues(attrs)
	return labels.FormatCadastroDescription(categoryName, values, p.Brand), nil
}

func attributeValues(attrs []domain.ProductAttributeValue) []string {
	parts := make([]labels.AttributeValue, len(attrs))
	for i, a := range attrs {
		parts[i] = labels.AttributeValue{
			DataType:     a.DataType,
			ValueText:    a.ValueText,
			ValueNumber:  a.ValueNumber,
			ValueBoolean: a.ValueBoolean,
		}
	}
	return labels.AttributeValuesFromParts(parts)
}

func (s *Service) GetCadastroLabel(ctx context.Context, skuCode string) (*labels.CadastroLabel, error) {
	sku, err := s.repo.GetSKUByCode(ctx, skuCode)
	if err != nil {
		return nil, err
	}
	if sku.ProductID == nil {
		return nil, domain.ErrInvalidInput
	}
	p, err := s.repo.GetProduct(ctx, *sku.ProductID)
	if err != nil {
		return nil, err
	}
	attrs, err := s.repo.ListProductAttributes(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	desc, err := s.productDescription(ctx, p, attrs)
	if err != nil {
		return nil, err
	}
	label := labels.BuildCadastroLabel(desc, sku.Code)
	return &label, nil
}

func (s *Service) CreateCadastro(ctx context.Context, in domain.CreateCadastroInput) (*domain.CadastroResult, error) {
	if strings.TrimSpace(in.Name) == "" || in.CategoryID == uuid.Nil {
		return nil, domain.ErrInvalidInput
	}
	categoryID := in.CategoryID
	p, err := s.CreateProduct(ctx, domain.CreateProductInput{
		Name:                   in.Name,
		CategoryID:             &categoryID,
		Description:            in.Description,
		Brand:                  in.Brand,
		Manufacturer:           in.Manufacturer,
		NameES:                 in.NameES,
		DescriptionES:          in.DescriptionES,
		GeneratedDescriptionES: in.GeneratedDescriptionES,
		Attributes:             in.Attributes,
	})
	if err != nil {
		return nil, err
	}
	sku, err := s.CreateSKU(ctx, domain.CreateSKUInput{
		ProductID:              p.ID,
		Name:                   in.Name,
		PublishComprasParaguai: in.PublishComprasParaguai,
		PublishEcommerce:       in.PublishEcommerce,
	})
	if err != nil {
		return nil, err
	}
	label, err := s.GetCadastroLabel(ctx, sku.Code)
	if err != nil {
		return nil, err
	}
	return &domain.CadastroResult{
		Product: p,
		SKU:     sku,
		Label:   *label,
	}, nil
}
