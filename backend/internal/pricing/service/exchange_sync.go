package service

import (
	"context"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/datacenterla/platform/internal/pricing/exchange"
)

var editableCurrencies = []string{"PYG", "BRL", "ARS"}

func businessDateParaguay() time.Time {
	loc, err := time.LoadLocation("America/Asuncion")
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

func (s *Service) EnsureTodayExchangeRates(ctx context.Context) error {
	day := businessDateParaguay()
	ok, err := s.repo.HasTodayExchangeRates(ctx, day, editableCurrencies)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	return s.syncTodayFromMarket(ctx, day)
}

func (s *Service) SyncTodayExchangeRatesFromMarket(ctx context.Context) (*domain.ExchangeRatesToday, error) {
	day := businessDateParaguay()
	if err := s.syncTodayFromMarket(ctx, day); err != nil {
		return nil, err
	}
	return s.listTodayExchangeRates(ctx)
}

func (s *Service) syncTodayFromMarket(ctx context.Context, day time.Time) error {
	fetcher := exchange.NewFetcher(s.exchangeAPIURL)
	snap, err := fetcher.FetchUSD(ctx, editableCurrencies)
	if err != nil {
		return err
	}
	for code, rate := range snap.Rates {
		if err := s.repo.UpsertExchangeRate(ctx, "USD", code, rate, day); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) listTodayExchangeRates(ctx context.Context) (*domain.ExchangeRatesToday, error) {
	_ = s.EnsureTodayExchangeRates(ctx)

	day := businessDateParaguay()
	rows, err := s.repo.GetExchangeRatesForDate(ctx, day)
	if err != nil {
		return nil, err
	}
	if len(rows) < len(editableCurrencies) {
		fallback, fbErr := s.repo.ListLatestRatesFromUSD(ctx)
		if fbErr != nil {
			return nil, fbErr
		}
		have := map[string]bool{}
		for _, row := range rows {
			have[row.ToCurrency] = true
		}
		for _, row := range fallback {
			if !have[row.ToCurrency] {
				rows = append(rows, row)
			}
		}
	}

	rateByCode := map[string]domain.ExchangeRateQuote{}
	var asOf time.Time
	for _, row := range rows {
		meta := currencyMeta(row.ToCurrency)
		rateByCode[row.ToCurrency] = domain.ExchangeRateQuote{
			FromCurrency:  row.FromCurrency,
			ToCurrency:    row.ToCurrency,
			Rate:          row.Rate,
			EffectiveDate: row.EffectiveDate,
			Label:         meta.Label,
			Symbol:        meta.Symbol,
		}
		if row.EffectiveDate.After(asOf) {
			asOf = row.EffectiveDate
		}
	}

	hasToday, _ := s.repo.HasTodayExchangeRates(ctx, day, editableCurrencies)
	source := "fallback"
	if hasToday {
		source = "market"
		if day.After(asOf) {
			asOf = day
		}
	}

	out := make([]domain.ExchangeRateQuote, 0, len(domain.AcceptedInParaguay))
	for _, c := range domain.AcceptedInParaguay {
		if c.Code == "USD" {
			out = append(out, domain.ExchangeRateQuote{
				FromCurrency:  "USD",
				ToCurrency:    "USD",
				Rate:          1,
				EffectiveDate: asOf,
				Label:         c.Label,
				Symbol:        c.Symbol,
			})
			continue
		}
		if q, ok := rateByCode[c.Code]; ok {
			out = append(out, q)
			continue
		}
		fallback := fallbackRate(c.Code)
		out = append(out, domain.ExchangeRateQuote{
			FromCurrency:  "USD",
			ToCurrency:    c.Code,
			Rate:          fallback,
			EffectiveDate: asOf,
			Label:         c.Label,
			Symbol:        c.Symbol,
		})
	}

	result := &domain.ExchangeRatesToday{
		BaseCurrency: "USD",
		AsOf:         asOf,
		Rates:        out,
		Source:       source,
	}
	if hasToday {
		if fetchedAt, err := s.repo.GetTodayRatesFetchedAt(ctx, day); err == nil && fetchedAt != nil {
			t := fetchedAt.UTC()
			result.FetchedAt = &t
		}
	}
	return result, nil
}

func fallbackRate(code string) float64 {
	switch strings.ToUpper(code) {
	case "BRL":
		return 5.85
	case "ARS":
		return 1200
	default:
		return 7500
	}
}
