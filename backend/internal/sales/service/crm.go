package service

import (
	"context"
	"strings"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

func (s *Service) GetCatalogProduct(ctx context.Context, skuID, warehouseID uuid.UUID) (*domain.CatalogProduct, error) {
	p, err := s.repo.GetEcommerceProduct(ctx, skuID, warehouseID)
	if err != nil {
		return nil, err
	}
	return s.enrichCatalogProduct(ctx, p, warehouseID)
}

func (s *Service) GetCatalogProductByCode(ctx context.Context, skuCode string, warehouseID uuid.UUID) (*domain.CatalogProduct, error) {
	code := strings.TrimSpace(skuCode)
	if code == "" {
		return nil, domain.ErrInvalidInput
	}
	p, err := s.repo.GetEcommerceProductByCode(ctx, code, warehouseID)
	if err != nil {
		return nil, err
	}
	return s.enrichCatalogProduct(ctx, p, warehouseID)
}

func (s *Service) enrichCatalogProduct(ctx context.Context, p *domain.CatalogProduct, warehouseID uuid.UUID) (*domain.CatalogProduct, error) {
	price, err := s.pricing.Resolve(ctx, p.SKUID, "b2c")
	if err != nil {
		return nil, err
	}
	p.PriceUSD = price.BasePriceUSD
	p.PriceWithIVA = price.PriceWithIVA
	p.PricePYG = price.PricePYG
	p.PriceWithIVAPYG = price.PriceWithIVAPYG
	p.ExchangeRateUSDToPYG = price.ExchangeRateUSDToPYG
	avail, err := s.stock.GetAvailability(ctx, p.SKUID, warehouseID)
	if err == nil {
		p.Available = avail.QtyAvailable
	}
	return p, nil
}

func (s *Service) ListLeads(ctx context.Context, limit int) ([]domain.Lead, error) {
	return s.repo.ListLeads(ctx, limit)
}

func (s *Service) ListWebsiteLeads(ctx context.Context, limit int) ([]domain.Lead, error) {
	return s.repo.ListWebsiteLeads(ctx, limit)
}

func (s *Service) CreateLead(ctx context.Context, in domain.CreateLeadInput) (*domain.Lead, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.CreateLead(ctx, in)
}

func (s *Service) UpdateLeadStatus(ctx context.Context, id uuid.UUID, status string) (*domain.Lead, error) {
	return s.repo.UpdateLeadStatus(ctx, id, status)
}

func (s *Service) ListPayables(ctx context.Context, limit int) ([]domain.Payable, error) {
	return s.repo.ListPayables(ctx, limit)
}

func (s *Service) PayPayable(ctx context.Context, id uuid.UUID, amount float64) (*domain.Payable, error) {
	if amount <= 0 {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.PayPayable(ctx, id, amount)
}
