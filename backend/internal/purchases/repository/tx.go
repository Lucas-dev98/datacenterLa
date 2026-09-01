package repository

import (
	"context"

	"github.com/datacenterla/platform/internal/purchases/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) WithTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Postgres) IncrementReceivedTx(ctx context.Context, tx pgx.Tx, poID, skuID uuid.UUID, qty int) error {
	tag, err := tx.Exec(ctx, `
		UPDATE purchase_order_items SET quantity_received = quantity_received + $3
		WHERE purchase_order_id = $1 AND sku_id = $2
		  AND quantity_received + $3 <= quantity_ordered
	`, poID, skuID, qty)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidInput
	}
	return nil
}

func (r *Postgres) RefreshPOStatusTx(ctx context.Context, tx pgx.Tx, poID uuid.UUID) error {
	var total, received int
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(quantity_ordered),0), COALESCE(SUM(quantity_received),0)
		FROM purchase_order_items WHERE purchase_order_id = $1
	`, poID).Scan(&total, &received)
	if err != nil {
		return err
	}
	status := "partial"
	if received >= total && total > 0 {
		status = "received"
	}
	_, err = tx.Exec(ctx, `
		UPDATE purchase_orders SET status = $2::purchase_order_status,
			received_at = CASE WHEN $2::text = 'received' THEN now() ELSE received_at END,
			updated_at = now()
		WHERE id = $1 AND status IN ('ordered', 'partial', 'received')
	`, poID, status)
	return err
}
