package service

import (
	"context"
	"math"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/datacenterla/platform/internal/pricing/repository"
	"github.com/google/uuid"
)

type Service struct {
	repo           *repository.Postgres
	exchangeAPIURL string
}

func New(repo *repository.Postgres, exchangeAPIURL string) *Service {
	return &Service{repo: repo, exchangeAPIURL: exchangeAPIURL}
}

func (s *Service) Get(ctx context.Context, skuID uuid.UUID) (*domain.SKUPrice, error) {
	return s.repo.Get(ctx, skuID)
}

func (s *Service) Upsert(ctx context.Context, skuID, userID uuid.UUID, in domain.UpsertPriceInput) (*domain.SKUPrice, error) {
	if skuID == uuid.Nil {
		return nil, domain.ErrInvalidInput
	}
	p, err := s.repo.Upsert(ctx, skuID, userID, in)
	if err != nil {
		return nil, err
	}
	_ = s.repo.InsertOutboxEvent(ctx, "pricing.updated", map[string]any{"sku_id": skuID.String()})
	return p, nil
}

func (s *Service) Resolve(ctx context.Context, skuID uuid.UUID, channel string) (*domain.ResolvedPrice, error) {
	p, err := s.repo.Get(ctx, skuID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	base := pickBase(p, strings.ToLower(channel), now)
	if base <= 0 {
		return nil, domain.ErrInvalidInput
	}
	withIVA := math.Round(base*(1+domain.TaxRateParaguay)*100) / 100
	rate, _ := s.repo.GetUSDToPYGRate(ctx)
	pricePYG := math.Round(base * rate)
	priceIVAPYG := math.Round(withIVA * rate)
	return &domain.ResolvedPrice{
		SKUID:                skuID,
		Channel:              channel,
		BasePriceUSD:         base,
		PriceWithIVA:         withIVA,
		PricePYG:             pricePYG,
		PriceWithIVAPYG:      priceIVAPYG,
		ExchangeRateUSDToPYG: rate,
		PromoApplied:         promoActive(p, now),
	}, nil
}

func pickBase(p *domain.SKUPrice, channel string, now time.Time) float64 {
	if promoActive(p, now) && p.PricePromoUSD != nil {
		return *p.PricePromoUSD
	}
	switch channel {
	case "b2c", "ecommerce", "compras_paraguai":
		if p.PriceB2CUSD != nil {
			return *p.PriceB2CUSD
		}
	case "reseller":
		if p.PriceResellerUSD != nil {
			return *p.PriceResellerUSD
		}
	default:
		if p.PriceB2BUSD != nil {
			return *p.PriceB2BUSD
		}
	}
	if p.PriceB2CUSD != nil {
		return *p.PriceB2CUSD
	}
	return 0
}

func promoActive(p *domain.SKUPrice, now time.Time) bool {
	if p.PricePromoUSD == nil {
		return false
	}
	if p.PromoStartsAt != nil && now.Before(*p.PromoStartsAt) {
		return false
	}
	if p.PromoEndsAt != nil && now.After(*p.PromoEndsAt) {
		return false
	}
	return true
}
