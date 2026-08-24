package repository

import (
	"context"
	"time"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) ListSoldUnitsByOrderItem(ctx context.Context, orderID uuid.UUID, orderItemID uuid.UUID, limit int) ([]domain.InventoryUnit, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.pool.Query(ctx, `
		SELECT `+unitColumns+`
		FROM inventory_units
		WHERE order_id = $1 AND order_item_id = $2 AND status = 'sold'
		ORDER BY sold_at NULLS LAST, created_at
		LIMIT $3
	`, orderID, orderItemID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUnits(rows)
}

func (r *Postgres) RestockReturnedUnit(ctx context.Context, tx pgx.Tx, unitID uuid.UUID, expectedVersion int, locationID uuid.UUID) (*domain.InventoryUnit, error) {
	now := time.Now().UTC()
	available := domain.StatusAvailable
	row := tx.QueryRow(ctx, `
		UPDATE inventory_units SET
			status = $3,
			location_id = $4,
			available_at = $5,
			sold_at = NULL,
			order_id = NULL,
			order_item_id = NULL,
			reservation_id = NULL,
			version = version + 1,
			updated_at = now()
		WHERE id = $1 AND version = $2 AND status = 'returned'
		RETURNING `+unitColumns,
		unitID, expectedVersion, available, locationID, now,
	)
	return scanUnit(row)
}
