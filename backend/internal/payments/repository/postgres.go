package repository

import (
	"context"
	"errors"

	"github.com/datacenterla/platform/internal/payments/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (r *Postgres) InsertIntent(ctx context.Context, in domain.CreateIntentInput, provider string) (*domain.PaymentIntent, error) {
	var pi domain.PaymentIntent
	err := r.pool.QueryRow(ctx, `
		INSERT INTO payment_intents (order_id, amount_usd, provider, client_secret, provider_ref)
		VALUES ($1, $2, $3, 'pending', NULL)
		RETURNING id, order_id, amount_usd, currency, provider, status::text, client_secret, provider_ref, created_at, completed_at
	`, in.OrderID, in.AmountUSD, provider).Scan(
		&pi.ID, &pi.OrderID, &pi.AmountUSD, &pi.Currency, &pi.Provider, &pi.Status,
		&pi.ClientSecret, &pi.ProviderRef, &pi.CreatedAt, &pi.CompletedAt)
	return &pi, err
}

func (r *Postgres) UpdateIntentGateway(ctx context.Context, id uuid.UUID, clientSecret, providerRef, provider string) (*domain.PaymentIntent, error) {
	var pi domain.PaymentIntent
	err := r.pool.QueryRow(ctx, `
		UPDATE payment_intents SET client_secret = $2, provider_ref = $3, provider = $4
		WHERE id = $1
		RETURNING id, order_id, amount_usd, currency, provider, status::text, client_secret, provider_ref, created_at, completed_at
	`, id, clientSecret, providerRef, provider).Scan(
		&pi.ID, &pi.OrderID, &pi.AmountUSD, &pi.Currency, &pi.Provider, &pi.Status,
		&pi.ClientSecret, &pi.ProviderRef, &pi.CreatedAt, &pi.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &pi, err
}

func (r *Postgres) GetIntent(ctx context.Context, id uuid.UUID) (*domain.PaymentIntent, error) {
	var pi domain.PaymentIntent
	err := r.pool.QueryRow(ctx, `
		SELECT id, order_id, amount_usd, currency, provider, status::text, client_secret, provider_ref, created_at, completed_at
		FROM payment_intents WHERE id = $1
	`, id).Scan(&pi.ID, &pi.OrderID, &pi.AmountUSD, &pi.Currency, &pi.Provider, &pi.Status,
		&pi.ClientSecret, &pi.ProviderRef, &pi.CreatedAt, &pi.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &pi, err
}

func (r *Postgres) GetIntentByProviderRef(ctx context.Context, providerRef string) (*domain.PaymentIntent, error) {
	var pi domain.PaymentIntent
	err := r.pool.QueryRow(ctx, `
		SELECT id, order_id, amount_usd, currency, provider, status::text, client_secret, provider_ref, created_at, completed_at
		FROM payment_intents WHERE provider_ref = $1
	`, providerRef).Scan(&pi.ID, &pi.OrderID, &pi.AmountUSD, &pi.Currency, &pi.Provider, &pi.Status,
		&pi.ClientSecret, &pi.ProviderRef, &pi.CreatedAt, &pi.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &pi, err
}

func (r *Postgres) MarkIntentCompleted(ctx context.Context, id uuid.UUID, providerRef string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE payment_intents SET status = 'completed', provider_ref = COALESCE(NULLIF($2,''), provider_ref), completed_at = now()
		WHERE id = $1 AND status = 'pending'
	`, id, providerRef)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidState
	}
	return nil
}

func (r *Postgres) MarkIntentFailed(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE payment_intents SET status = 'failed' WHERE id = $1 AND status = 'pending'
	`, id)
	return err
}
