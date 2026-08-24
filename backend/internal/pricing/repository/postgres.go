package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Postgres { return &Postgres{pool: pool} }

func (r *Postgres) Get(ctx context.Context, skuID uuid.UUID) (*domain.SKUPrice, error) {
	var p domain.SKUPrice
	err := r.pool.QueryRow(ctx, `
		SELECT sku_id, cost_usd, min_price_usd, price_b2c_usd, price_b2b_usd, price_reseller_usd,
		       price_promo_usd, promo_starts_at, promo_ends_at, updated_at
		FROM sku_prices WHERE sku_id = $1
	`, skuID).Scan(&p.SKUID, &p.CostUSD, &p.MinPriceUSD, &p.PriceB2CUSD, &p.PriceB2BUSD,
		&p.PriceResellerUSD, &p.PricePromoUSD, &p.PromoStartsAt, &p.PromoEndsAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &p, err
}

func (r *Postgres) InsertOutboxEvent(ctx context.Context, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)`, eventType, data)
	return err
}

func (r *Postgres) Upsert(ctx context.Context, skuID, userID uuid.UUID, in domain.UpsertPriceInput) (*domain.SKUPrice, error) {
	old, _ := r.Get(ctx, skuID)
	var p domain.SKUPrice
	err := r.pool.QueryRow(ctx, `
		INSERT INTO sku_prices (sku_id, cost_usd, min_price_usd, price_b2c_usd, price_b2b_usd,
			price_reseller_usd, price_promo_usd, promo_starts_at, promo_ends_at, updated_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (sku_id) DO UPDATE SET
			cost_usd = COALESCE(EXCLUDED.cost_usd, sku_prices.cost_usd),
			min_price_usd = COALESCE(EXCLUDED.min_price_usd, sku_prices.min_price_usd),
			price_b2c_usd = COALESCE(EXCLUDED.price_b2c_usd, sku_prices.price_b2c_usd),
			price_b2b_usd = COALESCE(EXCLUDED.price_b2b_usd, sku_prices.price_b2b_usd),
			price_reseller_usd = COALESCE(EXCLUDED.price_reseller_usd, sku_prices.price_reseller_usd),
			price_promo_usd = COALESCE(EXCLUDED.price_promo_usd, sku_prices.price_promo_usd),
			promo_starts_at = COALESCE(EXCLUDED.promo_starts_at, sku_prices.promo_starts_at),
			promo_ends_at = COALESCE(EXCLUDED.promo_ends_at, sku_prices.promo_ends_at),
			updated_by = EXCLUDED.updated_by,
			updated_at = now()
		RETURNING sku_id, cost_usd, min_price_usd, price_b2c_usd, price_b2b_usd, price_reseller_usd,
		          price_promo_usd, promo_starts_at, promo_ends_at, updated_at
	`, skuID, in.CostUSD, in.MinPriceUSD, in.PriceB2CUSD, in.PriceB2BUSD, in.PriceResellerUSD,
		in.PricePromoUSD, in.PromoStartsAt, in.PromoEndsAt, userID,
	).Scan(&p.SKUID, &p.CostUSD, &p.MinPriceUSD, &p.PriceB2CUSD, &p.PriceB2BUSD,
		&p.PriceResellerUSD, &p.PricePromoUSD, &p.PromoStartsAt, &p.PromoEndsAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if old != nil {
		r.recordChanges(ctx, skuID, userID, old, &p)
	}
	return &p, nil
}

func (r *Postgres) recordChanges(ctx context.Context, skuID, userID uuid.UUID, old, neu *domain.SKUPrice) {
	fields := []struct {
		name string
		old  *float64
		new  *float64
	}{
		{"cost_usd", old.CostUSD, neu.CostUSD},
		{"min_price_usd", old.MinPriceUSD, neu.MinPriceUSD},
		{"price_b2c_usd", old.PriceB2CUSD, neu.PriceB2CUSD},
		{"price_b2b_usd", old.PriceB2BUSD, neu.PriceB2BUSD},
		{"price_reseller_usd", old.PriceResellerUSD, neu.PriceResellerUSD},
		{"price_promo_usd", old.PricePromoUSD, neu.PricePromoUSD},
	}
	for _, f := range fields {
		if f.old == nil && f.new == nil {
			continue
		}
		if f.old != nil && f.new != nil && *f.old == *f.new {
			continue
		}
		_, _ = r.pool.Exec(ctx, `
			INSERT INTO price_history (sku_id, field_name, old_value, new_value, changed_by)
			VALUES ($1, $2, $3, $4, $5)
		`, skuID, f.name, f.old, f.new, userID)
	}
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
