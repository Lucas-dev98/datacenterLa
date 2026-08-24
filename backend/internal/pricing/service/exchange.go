package service

import (
	"context"
	"strings"

	"github.com/datacenterla/platform/internal/pricing/domain"
)

func (s *Service) ListTodayExchangeRates(ctx context.Context) (*domain.ExchangeRatesToday, error) {
	return s.listTodayExchangeRates(ctx)
}

func currencyMeta(code string) struct{ Label, Symbol string } {
	for _, c := range domain.AcceptedInParaguay {
		if c.Code == code {
			return struct{ Label, Symbol string }{c.Label, c.Symbol}
		}
	}
	return struct{ Label, Symbol string }{code, code}
}

func (s *Service) UpsertTodayExchangeRates(ctx context.Context, in domain.UpsertExchangeRatesInput) (*domain.ExchangeRatesToday, error) {
	if len(in.Rates) == 0 {
		return nil, domain.ErrInvalidInput
	}
	day := businessDateParaguay()
	allowed := map[string]bool{}
	for _, c := range domain.AcceptedInParaguay {
		if c.Code != "USD" {
			allowed[c.Code] = true
		}
	}
	for _, item := range in.Rates {
		code := strings.ToUpper(strings.TrimSpace(item.ToCurrency))
		if code == "USD" || !allowed[code] {
			return nil, domain.ErrInvalidInput
		}
		if item.Rate <= 0 {
			return nil, domain.ErrInvalidInput
		}
		if err := s.repo.UpsertExchangeRate(ctx, "USD", code, item.Rate, day); err != nil {
			return nil, err
		}
	}
	return s.listTodayExchangeRates(ctx)
}
