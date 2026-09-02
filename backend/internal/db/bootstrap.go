package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NeedsDemoSeed reports whether the database has no commercial catalog yet.
func NeedsDemoSeed(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM skus`).Scan(&n)
	if err != nil {
		return false, err
	}
	return n == 0, nil
}
