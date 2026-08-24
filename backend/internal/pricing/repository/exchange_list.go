package repository

import (
	"context"
	"time"
)

type ExchangeRateRow struct {
	FromCurrency  string
	ToCurrency    string
	Rate          float64
	EffectiveDate time.Time
}

func (r *Postgres) ListLatestRatesFromUSD(ctx context.Context) ([]ExchangeRateRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT ON (to_currency)
			from_currency, to_currency, rate, effective_date
		FROM exchange_rates
		WHERE from_currency = 'USD'
		ORDER BY to_currency, effective_date DESC, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ExchangeRateRow
	for rows.Next() {
		var row ExchangeRateRow
		if err := rows.Scan(&row.FromCurrency, &row.ToCurrency, &row.Rate, &row.EffectiveDate); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Postgres) GetExchangeRatesForDate(ctx context.Context, day time.Time) ([]ExchangeRateRow, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT ON (to_currency)
			from_currency, to_currency, rate, effective_date
		FROM exchange_rates
		WHERE from_currency = 'USD' AND effective_date = $1::date
		ORDER BY to_currency, created_at DESC
	`, day)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ExchangeRateRow
	for rows.Next() {
		var row ExchangeRateRow
		if err := rows.Scan(&row.FromCurrency, &row.ToCurrency, &row.Rate, &row.EffectiveDate); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Postgres) UpsertExchangeRate(ctx context.Context, fromCurrency, toCurrency string, rate float64, effectiveDate time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
		VALUES ($1, $2, $3, $4::date)
		ON CONFLICT (from_currency, to_currency, effective_date) DO UPDATE SET
			rate = EXCLUDED.rate,
			created_at = now()
	`, fromCurrency, toCurrency, rate, effectiveDate)
	return err
}

func (r *Postgres) HasTodayExchangeRates(ctx context.Context, day time.Time, currencies []string) (bool, error) {
	if len(currencies) == 0 {
		return false, nil
	}
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT to_currency)
		FROM exchange_rates
		WHERE from_currency = 'USD'
		  AND effective_date = $1::date
		  AND to_currency = ANY($2)
	`, day, currencies).Scan(&count)
	if err != nil {
		return false, err
	}
	return count >= len(currencies), nil
}

func (r *Postgres) GetTodayRatesFetchedAt(ctx context.Context, day time.Time) (*time.Time, error) {
	var fetchedAt time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT MAX(created_at)
		FROM exchange_rates
		WHERE from_currency = 'USD' AND effective_date = $1::date
	`, day).Scan(&fetchedAt)
	if err != nil {
		return nil, err
	}
	return &fetchedAt, nil
}
