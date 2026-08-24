package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Postgres { return &Postgres{pool: pool} }

func (r *Postgres) InsertCode(ctx context.Context, email, codeHash string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO shop_login_codes (email, code_hash, expires_at)
		VALUES ($1, $2, $3)
	`, email, codeHash, expiresAt)
	return err
}

func (r *Postgres) CountRecentCodes(ctx context.Context, email string, since time.Time) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM shop_login_codes
		WHERE LOWER(email) = LOWER($1) AND created_at >= $2
	`, email, since).Scan(&n)
	return n, err
}

func (r *Postgres) LastCodeCreatedAt(ctx context.Context, email string) (*time.Time, error) {
	var t time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT created_at FROM shop_login_codes
		WHERE LOWER(email) = LOWER($1)
		ORDER BY created_at DESC
		LIMIT 1
	`, email).Scan(&t)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *Postgres) ConsumeValidCode(ctx context.Context, email, codeHash string, now time.Time) (bool, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM shop_login_codes
		WHERE LOWER(email) = LOWER($1)
		  AND code_hash = $2
		  AND used_at IS NULL
		  AND expires_at > $3
		ORDER BY created_at DESC
		LIMIT 1
	`, email, codeHash, now).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE shop_login_codes SET used_at = $2 WHERE id = $1 AND used_at IS NULL
	`, id, now)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Postgres) EmailHasShopOrders(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM orders o
			JOIN customers c ON c.id = o.customer_id
			WHERE LOWER(COALESCE(c.email, '')) = LOWER($1)
			  AND o.channel = 'ecommerce'
			  AND o.status NOT IN ('draft', 'cancelled')
		)
	`, email).Scan(&exists)
	return exists, err
}
