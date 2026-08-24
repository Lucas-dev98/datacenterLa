package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (r *Postgres) GetUSDToPYGRate(ctx context.Context) (float64, error) {
	var rate float64
	err := r.pool.QueryRow(ctx, `
		SELECT rate FROM exchange_rates
		WHERE from_currency = 'USD' AND to_currency = 'PYG'
		ORDER BY effective_date DESC, created_at DESC
		LIMIT 1
	`).Scan(&rate)
	if errors.Is(err, pgx.ErrNoRows) {
		return 7500, nil
	}
	return rate, err
}
