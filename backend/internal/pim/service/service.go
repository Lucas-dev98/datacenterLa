package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/datacenterla/platform/internal/pim/domain"
	"github.com/datacenterla/platform/internal/pim/repository"
	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Postgres
}

func New(repo *repository.Postgres) *Service {
	return &Service{repo: repo}
}

// --- Categories ---

func (s *Service) CreateCategory(ctx context.Context, in domain.CreateCategoryInput) (*domain.Category, error) {
	if strings.TrimSpace(in.Code) == "" || strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.CreateCategory(ctx, in)
}

func (s *Service) GetCategory(ctx context.Context, id uuid.UUID) (*domain.Category, error) {
	return s.repo.GetCategory(ctx, id)
}

func (s *Service) ListCategories(ctx context.Context, activeOnly bool) ([]domain.Category, error) {
	return s.repo.ListCategories(ctx, activeOnly)
}

func (s *Service) UpdateCategory(ctx context.Context, id uuid.UUID, in domain.UpdateCategoryInput) (*domain.Category, error) {
	return s.repo.UpdateCategory(ctx, id, in)
}

func (s *Service) CreateCategoryAttribute(ctx context.Context, categoryID uuid.UUID, in domain.CreateCategoryAttributeInput) (*domain.CategoryAttribute, error) {
	if strings.TrimSpace(in.Code) == "" || strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	if in.DataType == "" {
		in.DataType = "text"
	}
	switch in.DataType {
	case "text", "number", "boolean":
	default:
		return nil, domain.ErrInvalidInput
	}
	exists, err := s.repo.CategoryExists(ctx, categoryID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, domain.ErrNotFound
	}
	return s.repo.CreateCategoryAttribute(ctx, categoryID, in)
}

func (s *Service) ListCategoryAttributes(ctx context.Context, categoryID uuid.UUID) ([]domain.CategoryAttribute, error) {
	return s.repo.ListCategoryAttributes(ctx, categoryID)
}

// --- Products ---

func (s *Service) CreateProduct(ctx context.Context, in domain.CreateProductInput) (*domain.Product, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	if in.CategoryID != nil {
		ok, err := s.repo.CategoryExists(ctx, *in.CategoryID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("%w: category not found", domain.ErrInvalidInput)
		}
	}
	if err := s.validateAttributes(ctx, in.CategoryID, in.Attributes); err != nil {
		return nil, err
	}

	p, err := s.repo.CreateProduct(ctx, in)
	if err != nil {
		return nil, err
	}
	if len(in.Attributes) > 0 {
		if err := s.repo.UpsertProductAttributes(ctx, p.ID, in.Attributes); err != nil {
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
		p, err = s.repo.UpdateProduct(ctx, p.ID, domain.UpdateProductInput{}, &desc)
		if err != nil {
			return nil, err
		}
	}
	return s.enrichProduct(ctx, p, true)
}

func (s *Service) GetProduct(ctx context.Context, id uuid.UUID, withSKUs bool) (*domain.Product, error) {
	p, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.enrichProduct(ctx, p, withSKUs)
}

func (s *Service) ListProducts(ctx context.Context, f domain.ListFilter) (*domain.ListResult[domain.Product], error) {
	items, total, err := s.repo.ListProducts(ctx, f)
	if err != nil {
		return nil, err
	}
	return &domain.ListResult[domain.Product]{
		Items: items, Total: total, Limit: f.Limit, Offset: f.Offset,
	}, nil
}

func (s *Service) UpdateProduct(ctx context.Context, id uuid.UUID, in domain.UpdateProductInput) (*domain.Product, error) {
	current, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	categoryID := current.CategoryID
	if in.CategoryID != nil {
		categoryID = in.CategoryID
		ok, err := s.repo.CategoryExists(ctx, *in.CategoryID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("%w: category not found", domain.ErrInvalidInput)
		}
	}
	if in.Attributes != nil {
		if err := s.validateAttributes(ctx, categoryID, in.Attributes); err != nil {
			return nil, err
		}
	}

	var generated *string
	if in.Attributes != nil {
		if err := s.repo.UpsertProductAttributes(ctx, id, in.Attributes); err != nil {
			return nil, err
		}
		attrs, err := s.repo.ListProductAttributes(ctx, id)
		if err != nil {
			return nil, err
		}
		updated := *current
		if in.CategoryID != nil {
			updated.CategoryID = in.CategoryID
		}
		if in.Brand != nil {
			updated.Brand = in.Brand
		}
		desc, err := s.productDescription(ctx, &updated, attrs)
		if err != nil {
			return nil, err
		}
		generated = &desc
	}

	p, err := s.repo.UpdateProduct(ctx, id, in, generated)
	if err != nil {
		return nil, err
	}
	return s.enrichProduct(ctx, p, true)
}

func (s *Service) DeactivateProduct(ctx context.Context, id uuid.UUID) error {
	skus, _, err := s.repo.ListSKUs(ctx, domain.ListFilter{ProductID: &id, ActiveOnly: true, Limit: 1})
	if err != nil {
		return err
	}
	if len(skus) > 0 {
		return fmt.Errorf("%w: product has active SKUs", domain.ErrHasDependents)
	}
	return s.repo.DeactivateProduct(ctx, id)
}

// --- SKUs ---

func (s *Service) CreateSKU(ctx context.Context, in domain.CreateSKUInput) (*domain.SKU, error) {
	if in.ProductID == uuid.Nil || strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	ok, err := s.repo.ProductExists(ctx, in.ProductID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("%w: product not found", domain.ErrInvalidInput)
	}
	return s.repo.CreateSKU(ctx, in)
}

func (s *Service) GetSKU(ctx context.Context, id uuid.UUID) (*domain.SKU, error) {
	return s.repo.GetSKU(ctx, id)
}

func (s *Service) GetSKUByCode(ctx context.Context, code string) (*domain.SKU, error) {
	return s.repo.GetSKUByCode(ctx, code)
}

func (s *Service) ListSKUs(ctx context.Context, f domain.ListFilter) (*domain.ListResult[domain.SKU], error) {
	items, total, err := s.repo.ListSKUs(ctx, f)
	if err != nil {
		return nil, err
	}
	return &domain.ListResult[domain.SKU]{
		Items: items, Total: total, Limit: f.Limit, Offset: f.Offset,
	}, nil
}

func (s *Service) UpdateSKU(ctx context.Context, id uuid.UUID, in domain.UpdateSKUInput) (*domain.SKU, error) {
	sku, err := s.repo.UpdateSKU(ctx, id, in)
	if err != nil {
		return nil, err
	}
	if in.PublishComprasParaguai != nil || in.ImageURL != nil {
		_ = s.repo.InsertOutboxEvent(ctx, "pim.publish_changed", map[string]any{"sku_id": id.String()})
	}
	return sku, nil
}

func (s *Service) DeactivateSKU(ctx context.Context, id uuid.UUID) error {
	n, err := s.repo.CountSKUInventory(ctx, id)
	if err != nil {
		return err
	}
	if n > 0 {
		return fmt.Errorf("%w: sku has inventory units", domain.ErrHasDependents)
	}
	return s.repo.DeactivateSKU(ctx, id)
}

func (s *Service) enrichProduct(ctx context.Context, p *domain.Product, withSKUs bool) (*domain.Product, error) {
	attrs, err := s.repo.ListProductAttributes(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Attributes = attrs
	if len(attrs) > 0 && (p.GeneratedDescription == nil || *p.GeneratedDescription == "") {
		desc, err := s.productDescription(ctx, p, attrs)
		if err != nil {
			return nil, err
		}
		p.GeneratedDescription = &desc
	}
	if withSKUs {
		skus, _, err := s.repo.ListSKUs(ctx, domain.ListFilter{ProductID: &p.ID, Limit: 100})
		if err != nil {
			return nil, err
		}
		p.SKUs = skus
	}
	return p, nil
}

func (s *Service) validateAttributes(ctx context.Context, categoryID *uuid.UUID, attrs []domain.AttributeValueInput) error {
	if len(attrs) == 0 {
		return nil
	}
	if categoryID == nil {
		return fmt.Errorf("%w: category required for attributes", domain.ErrInvalidInput)
	}
	defs, err := s.repo.ListCategoryAttributes(ctx, *categoryID)
	if err != nil {
		return err
	}
	defByID := map[uuid.UUID]domain.CategoryAttribute{}
	for _, d := range defs {
		defByID[d.ID] = d
	}
	seen := map[uuid.UUID]bool{}
	for _, a := range attrs {
		if seen[a.CategoryAttributeID] {
			return fmt.Errorf("%w: duplicate attribute", domain.ErrInvalidInput)
		}
		seen[a.CategoryAttributeID] = true
		def, ok := defByID[a.CategoryAttributeID]
		if !ok {
			return fmt.Errorf("%w: attribute does not belong to category", domain.ErrInvalidInput)
		}
		if err := validateAttributeValue(def, a); err != nil {
			return err
		}
	}
	for _, def := range defs {
		if !def.IsRequired {
			continue
		}
		if !seen[def.ID] {
			return fmt.Errorf("%w: required attribute %s missing", domain.ErrInvalidInput, def.Code)
		}
	}
	return nil
}

func validateAttributeValue(def domain.CategoryAttribute, a domain.AttributeValueInput) error {
	switch def.DataType {
	case "text":
		if a.ValueText == nil || strings.TrimSpace(*a.ValueText) == "" {
			return fmt.Errorf("%w: attribute %s requires text value", domain.ErrInvalidInput, def.Code)
		}
	case "number":
		if a.ValueNumber == nil {
			return fmt.Errorf("%w: attribute %s requires number value", domain.ErrInvalidInput, def.Code)
		}
	case "boolean":
		if a.ValueBoolean == nil {
			return fmt.Errorf("%w: attribute %s requires boolean value", domain.ErrInvalidInput, def.Code)
		}
	}
	return nil
}

