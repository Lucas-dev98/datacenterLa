package repository

import (
	"context"
	"errors"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) CreateStockCount(ctx context.Context, in domain.CreateCountInput) (*domain.StockCount, error) {
	var c domain.StockCount
	countType := in.CountType
	if countType == "" {
		countType = "full"
	}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO stock_counts (warehouse_id, count_type, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, warehouse_id, count_type, status::text, started_at, completed_at, created_by, approved_by, created_at
	`, in.WarehouseID, countType, in.CreatedBy).Scan(
		&c.ID, &c.WarehouseID, &c.CountType, &c.Status, &c.StartedAt, &c.CompletedAt,
		&c.CreatedBy, &c.ApprovedBy, &c.CreatedAt,
	)
	return &c, err
}

func (r *Postgres) GetStockCount(ctx context.Context, id uuid.UUID) (*domain.StockCount, error) {
	var c domain.StockCount
	err := r.pool.QueryRow(ctx, `
		SELECT id, warehouse_id, count_type, status::text, started_at, completed_at, created_by, approved_by, created_at
		FROM stock_counts WHERE id = $1
	`, id).Scan(&c.ID, &c.WarehouseID, &c.CountType, &c.Status, &c.StartedAt, &c.CompletedAt,
		&c.CreatedBy, &c.ApprovedBy, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.Lines, err = r.listCountLines(ctx, id)
	return &c, err
}

func (r *Postgres) ListStockCounts(ctx context.Context, limit int) ([]domain.StockCount, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, warehouse_id, count_type, status::text, started_at, completed_at, created_by, approved_by, created_at
		FROM stock_counts ORDER BY created_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.StockCount
	for rows.Next() {
		var c domain.StockCount
		if err := rows.Scan(&c.ID, &c.WarehouseID, &c.CountType, &c.Status, &c.StartedAt, &c.CompletedAt,
			&c.CreatedBy, &c.ApprovedBy, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Postgres) StartStockCount(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_counts SET status = 'in_progress', started_at = now()
		WHERE id = $1 AND status = 'draft'
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidInput
	}
	return nil
}

func (r *Postgres) UpsertCountLineBySKU(ctx context.Context, countID, skuID uuid.UUID, countedQty int) error {
	var systemQty int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(b.qty_physical, 0) FROM stock_balances b
		JOIN stock_counts c ON c.warehouse_id = b.warehouse_id
		WHERE c.id = $1 AND b.sku_id = $2
	`, countID, skuID).Scan(&systemQty)
	if errors.Is(err, pgx.ErrNoRows) {
		systemQty = 0
	} else if err != nil {
		return err
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_count_lines SET counted_qty = $3, status = 'counted'
		WHERE stock_count_id = $1 AND sku_id = $2
	`, countID, skuID, countedQty)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO stock_count_lines (stock_count_id, sku_id, system_qty, counted_qty, status)
		VALUES ($1, $2, $3, $4, 'counted')
	`, countID, skuID, systemQty, countedQty)
	return err
}

func (r *Postgres) UpsertCountLineByUnit(ctx context.Context, countID uuid.UUID, unit *domain.InventoryUnit) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO stock_count_lines (stock_count_id, inventory_unit_id, sku_id, system_qty, counted_qty, status)
		VALUES ($1, $2, $3, 1, 1, 'counted')
		ON CONFLICT (stock_count_id, inventory_unit_id) WHERE inventory_unit_id IS NOT NULL
		DO UPDATE SET counted_qty = 1, status = 'counted', sku_id = EXCLUDED.sku_id
	`, countID, unit.ID, unit.SKUID)
	return err
}

func (r *Postgres) CompleteStockCount(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_counts SET status = 'pending_review', completed_at = now()
		WHERE id = $1 AND status = 'in_progress'
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidInput
	}
	return nil
}

func (r *Postgres) listCountLines(ctx context.Context, countID uuid.UUID) ([]domain.StockCountLine, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT l.id, l.sku_id, s.code, l.inventory_unit_id, u.public_code,
		       l.system_qty, l.counted_qty, l.variance, COALESCE(l.status, 'pending')
		FROM stock_count_lines l
		LEFT JOIN skus s ON s.id = l.sku_id
		LEFT JOIN inventory_units u ON u.id = l.inventory_unit_id
		WHERE l.stock_count_id = $1
		ORDER BY l.id
	`, countID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.StockCountLine
	for rows.Next() {
		var l domain.StockCountLine
		if err := rows.Scan(&l.ID, &l.SKUID, &l.SKUCode, &l.InventoryUnitID, &l.UnitCode,
			&l.SystemQty, &l.CountedQty, &l.Variance, &l.Status); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Postgres) ApproveStockCount(ctx context.Context, countID, approvedBy uuid.UUID) ([]domain.StockCountLine, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_counts SET status = 'approved', approved_by = $2
		WHERE id = $1 AND status = 'pending_review'
	`, countID, approvedBy)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, domain.ErrInvalidInput
	}
	return r.listCountLines(ctx, countID)
}

func (r *Postgres) CreateAdjustment(ctx context.Context, in domain.CreateAdjustmentInput) (*domain.StockAdjustment, error) {
	var a domain.StockAdjustment
	err := r.pool.QueryRow(ctx, `
		INSERT INTO stock_adjustments (warehouse_id, sku_id, quantity_delta, estimated_value_usd, reason, requested_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, warehouse_id, sku_id, quantity_delta, estimated_value_usd, reason, status::text, requested_by, approved_by, created_at
	`, in.WarehouseID, in.SKUID, in.QuantityDelta, in.EstimatedValueUSD, in.Reason, in.RequestedBy).Scan(
		&a.ID, &a.WarehouseID, &a.SKUID, &a.QuantityDelta, &a.EstimatedValueUSD, &a.Reason,
		&a.Status, &a.RequestedBy, &a.ApprovedBy, &a.CreatedAt,
	)
	return &a, err
}

func (r *Postgres) CreateAdjustmentFromCount(ctx context.Context, countID, warehouseID, skuID, approvedBy uuid.UUID, delta int, reason string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO stock_adjustments (warehouse_id, sku_id, quantity_delta, reason, status, stock_count_id, requested_by, approved_by)
		VALUES ($1, $2, $3, $4, 'approved', $5, $6, $6)
	`, warehouseID, skuID, delta, reason, countID, approvedBy)
	return err
}

func (r *Postgres) GetAdjustment(ctx context.Context, id uuid.UUID) (*domain.StockAdjustment, error) {
	var a domain.StockAdjustment
	err := r.pool.QueryRow(ctx, `
		SELECT a.id, a.warehouse_id, a.sku_id, s.code, a.quantity_delta, a.estimated_value_usd,
		       a.reason, a.status::text, a.stock_count_id, a.requested_by, a.approved_by, a.created_at
		FROM stock_adjustments a
		LEFT JOIN skus s ON s.id = a.sku_id
		WHERE a.id = $1
	`, id).Scan(&a.ID, &a.WarehouseID, &a.SKUID, &a.SKUCode, &a.QuantityDelta, &a.EstimatedValueUSD,
		&a.Reason, &a.Status, &a.StockCountID, &a.RequestedBy, &a.ApprovedBy, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &a, err
}

func (r *Postgres) ListAdjustments(ctx context.Context, status string, limit int) ([]domain.StockAdjustment, error) {
	if limit <= 0 {
		limit = 30
	}
	var rows pgx.Rows
	var err error
	if status != "" {
		rows, err = r.pool.Query(ctx, `
			SELECT a.id, a.warehouse_id, a.sku_id, s.code, a.quantity_delta, a.estimated_value_usd,
			       a.reason, a.status::text, a.stock_count_id, a.requested_by, a.approved_by, a.created_at
			FROM stock_adjustments a
			LEFT JOIN skus s ON s.id = a.sku_id
			WHERE a.status = $1::adjustment_status
			ORDER BY a.created_at DESC LIMIT $2
		`, status, limit)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT a.id, a.warehouse_id, a.sku_id, s.code, a.quantity_delta, a.estimated_value_usd,
			       a.reason, a.status::text, a.stock_count_id, a.requested_by, a.approved_by, a.created_at
			FROM stock_adjustments a
			LEFT JOIN skus s ON s.id = a.sku_id
			ORDER BY a.created_at DESC LIMIT $1
		`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.StockAdjustment
	for rows.Next() {
		var a domain.StockAdjustment
		if err := rows.Scan(&a.ID, &a.WarehouseID, &a.SKUID, &a.SKUCode, &a.QuantityDelta, &a.EstimatedValueUSD,
			&a.Reason, &a.Status, &a.StockCountID, &a.RequestedBy, &a.ApprovedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *Postgres) ApproveAdjustment(ctx context.Context, id, approvedBy uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_adjustments SET status = 'approved', approved_by = $2
		WHERE id = $1 AND status = 'pending'
	`, id, approvedBy)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidInput
	}
	return nil
}

func (r *Postgres) MarkAdjustmentApplied(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_adjustments SET status = 'applied' WHERE id = $1 AND status = 'approved'
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidInput
	}
	return nil
}

func (r *Postgres) GetFirstLocationID(ctx context.Context, warehouseID uuid.UUID) (*uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT id FROM locations WHERE warehouse_id = $1 ORDER BY code LIMIT 1`, warehouseID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (r *Postgres) ListAvailableUnitsForSKU(ctx context.Context, skuID, warehouseID uuid.UUID, limit int) ([]domain.InventoryUnit, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, unitSelect+`
		WHERE sku_id = $1 AND warehouse_id = $2 AND status = 'available'
		ORDER BY available_at NULLS LAST, created_at
		LIMIT $3
	`, skuID, warehouseID, limit)
	if err != nil {
		return nil, err
	}
	return scanUnits(rows)
}
