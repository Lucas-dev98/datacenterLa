package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/platform/labels"
	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

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

func (r *Postgres) GetUnitByID(ctx context.Context, id uuid.UUID) (*domain.InventoryUnit, error) {
	return scanUnit(r.pool.QueryRow(ctx, unitSelect+" WHERE id = $1", id))
}

func (r *Postgres) GetUnitByCode(ctx context.Context, code string) (*domain.InventoryUnit, error) {
	return scanUnit(r.pool.QueryRow(ctx, unitSelect+" WHERE public_code = $1", strings.ToUpper(strings.TrimSpace(code))))
}

func (r *Postgres) GetUnitLabelData(ctx context.Context, code string) (*domain.UnitLabelData, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	var data domain.UnitLabelData
	var categoryName *string
	err := r.pool.QueryRow(ctx, `
		SELECT u.public_code, s.code, p.generated_description, p.name, p.brand, c.name
		FROM inventory_units u
		JOIN skus s ON s.id = u.sku_id
		JOIN products p ON p.id = s.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE u.public_code = $1
	`, code).Scan(&data.UnitCode, &data.SKUCode, &data.GeneratedDescription, &data.ProductName, &data.Brand, &categoryName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	data.CategoryName = categoryName

	rows, err := r.pool.Query(ctx, `
		SELECT a.data_type, v.value_text, v.value_number, v.value_boolean
		FROM inventory_units u
		JOIN skus s ON s.id = u.sku_id
		JOIN product_attribute_values v ON v.product_id = s.product_id
		JOIN category_attributes a ON a.id = v.category_attribute_id
		WHERE u.public_code = $1
		ORDER BY a.sort_order, a.name
	`, code)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var part labels.AttributeValue
		if err := rows.Scan(&part.DataType, &part.ValueText, &part.ValueNumber, &part.ValueBoolean); err != nil {
			return nil, err
		}
		if v := labels.FormatAttributeValue(part); v != "" {
			data.AttributeValues = append(data.AttributeValues, v)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &data, nil
}

func (r *Postgres) GetBalance(ctx context.Context, skuID, warehouseID uuid.UUID) (*domain.StockBalance, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT sku_id, warehouse_id, qty_physical, qty_reserved, qty_available, updated_at
		FROM stock_balances WHERE sku_id = $1 AND warehouse_id = $2
	`, skuID, warehouseID)
	b, err := scanBalance(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return &domain.StockBalance{SKUID: skuID, WarehouseID: warehouseID}, nil
	}
	return b, err
}

func (r *Postgres) LockBalance(ctx context.Context, tx pgx.Tx, skuID, warehouseID uuid.UUID) (*domain.StockBalance, error) {
	row := tx.QueryRow(ctx, `
		SELECT sku_id, warehouse_id, qty_physical, qty_reserved, qty_available, updated_at
		FROM stock_balances WHERE sku_id = $1 AND warehouse_id = $2
		FOR UPDATE
	`, skuID, warehouseID)
	b, err := scanBalance(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return &domain.StockBalance{SKUID: skuID, WarehouseID: warehouseID}, nil
	}
	return b, err
}

func (r *Postgres) EnsureBalanceRow(ctx context.Context, tx pgx.Tx, skuID, warehouseID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO stock_balances (sku_id, warehouse_id) VALUES ($1, $2)
		ON CONFLICT (sku_id, warehouse_id) DO NOTHING
	`, skuID, warehouseID)
	return err
}

func (r *Postgres) UpdateBalancePhysical(ctx context.Context, tx pgx.Tx, skuID, warehouseID uuid.UUID, delta int) error {
	if err := r.EnsureBalanceRow(ctx, tx, skuID, warehouseID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		UPDATE stock_balances
		SET qty_physical = qty_physical + $3, updated_at = now()
		WHERE sku_id = $1 AND warehouse_id = $2
	`, skuID, warehouseID, delta)
	return err
}

func (r *Postgres) UpdateBalanceReserved(ctx context.Context, tx pgx.Tx, skuID, warehouseID uuid.UUID, delta int) error {
	if err := r.EnsureBalanceRow(ctx, tx, skuID, warehouseID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		UPDATE stock_balances
		SET qty_reserved = qty_reserved + $3, updated_at = now()
		WHERE sku_id = $1 AND warehouse_id = $2
	`, skuID, warehouseID, delta)
	return err
}

func (r *Postgres) CreateUnit(ctx context.Context, tx pgx.Tx, unit *domain.InventoryUnit) error {
	err := tx.QueryRow(ctx, `
		INSERT INTO inventory_units (
			public_code, sku_id, warehouse_id, status, purchase_id, unit_cost_usd,
			received_at, serial_number, notes, intake_batch_id
		) VALUES (
			generate_unit_public_code(), $1, $2, $3, $4, $5, $6, $7, $8, $9
		)
		RETURNING id, public_code, version, created_at, updated_at
	`, unit.SKUID, unit.WarehouseID, unit.Status, unit.PurchaseID, unit.UnitCostUSD,
		unit.ReceivedAt, unit.SerialNumber, unit.Notes, unit.IntakeBatchID,
	).Scan(&unit.ID, &unit.UnitCode, &unit.Version, &unit.CreatedAt, &unit.UpdatedAt)
	return err
}

type UnitPatch struct {
	Status        *domain.UnitStatus
	LocationID    *uuid.UUID
	AvailableAt   *time.Time
	SoldAt        *time.Time
	OrderID       *uuid.UUID
	OrderItemID   *uuid.UUID
	ReservationID *uuid.UUID
}

func UnitPatchFrom(
	to domain.UnitStatus,
	locationID *uuid.UUID,
	availableAt, soldAt *time.Time,
	orderID, orderItemID, reservationID *uuid.UUID,
) UnitPatch {
	status := to
	return UnitPatch{
		Status:        &status,
		LocationID:    locationID,
		AvailableAt:   availableAt,
		SoldAt:        soldAt,
		OrderID:       orderID,
		OrderItemID:   orderItemID,
		ReservationID: reservationID,
	}
}

func UnitSelectForUpdate() string {
	return unitSelect + " WHERE id = $1 FOR UPDATE"
}

func ScanUnitRow(row pgx.Row) (*domain.InventoryUnit, error) {
	return scanUnit(row)
}

func (r *Postgres) UpdateUnitStatus(ctx context.Context, tx pgx.Tx, unitID uuid.UUID, expectedVersion int, patch UnitPatch) (*domain.InventoryUnit, error) {
	row := tx.QueryRow(ctx, `
		UPDATE inventory_units SET
			status = COALESCE($3, status),
			location_id = COALESCE($4, location_id),
			available_at = COALESCE($5, available_at),
			sold_at = COALESCE($6, sold_at),
			order_id = COALESCE($7, order_id),
			order_item_id = COALESCE($8, order_item_id),
			reservation_id = COALESCE($9, reservation_id),
			version = version + 1,
			updated_at = now()
		WHERE id = $1 AND version = $2
		RETURNING `+unitColumns,
		unitID, expectedVersion, patch.Status, patch.LocationID, patch.AvailableAt,
		patch.SoldAt, patch.OrderID, patch.OrderItemID, patch.ReservationID,
	)
	unit, err := scanUnit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrVersionConflict
	}
	return unit, err
}

func (r *Postgres) InsertMovement(ctx context.Context, tx pgx.Tx, m *domain.StockMovement) error {
	err := tx.QueryRow(ctx, `
		INSERT INTO stock_movements (
			movement_type, sku_id, warehouse_id, inventory_unit_id, quantity,
			unit_status_before, unit_status_after, reference_type, reference_id,
			reason, created_by, idempotency_key
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, created_at
	`, m.MovementType, m.SKUID, m.WarehouseID, m.InventoryUnitID, m.Quantity,
		m.StatusBefore, m.StatusAfter, m.ReferenceType, m.ReferenceID,
		m.Reason, m.CreatedBy, m.IdempotencyKey,
	).Scan(&m.ID, &m.CreatedAt)
	if isUniqueViolation(err) {
		return domain.ErrDuplicateIdempotency
	}
	return err
}

func (r *Postgres) InsertReservation(ctx context.Context, tx pgx.Tx, res *domain.StockReservation) error {
	return tx.QueryRow(ctx, `
		INSERT INTO stock_reservations (
			order_id, order_item_id, sku_id, warehouse_id, inventory_unit_id,
			quantity, expires_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, status, created_at
	`, res.OrderID, res.OrderItemID, res.SKUID, res.WarehouseID, res.InventoryUnitID,
		res.Quantity, res.ExpiresAt,
	).Scan(&res.ID, &res.Status, &res.CreatedAt)
}

func (r *Postgres) ListAvailableUnits(ctx context.Context, tx pgx.Tx, skuID, warehouseID uuid.UUID, limit int) ([]domain.InventoryUnit, error) {
	rows, err := tx.Query(ctx, unitSelect+`
		WHERE sku_id = $1 AND warehouse_id = $2 AND status = 'available'
		ORDER BY available_at NULLS LAST, created_at
		LIMIT $3
		FOR UPDATE
	`, skuID, warehouseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUnits(rows)
}

func (r *Postgres) ListActiveReservationsByOrder(ctx context.Context, tx pgx.Tx, orderID uuid.UUID) ([]domain.StockReservation, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, order_id, order_item_id, sku_id, warehouse_id, inventory_unit_id,
		       quantity, status, expires_at, created_at
		FROM stock_reservations
		WHERE order_id = $1 AND status = 'active'
		FOR UPDATE
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.StockReservation
	for rows.Next() {
		var res domain.StockReservation
		if err := rows.Scan(&res.ID, &res.OrderID, &res.OrderItemID, &res.SKUID, &res.WarehouseID,
			&res.InventoryUnitID, &res.Quantity, &res.Status, &res.ExpiresAt, &res.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, res)
	}
	return out, rows.Err()
}

func (r *Postgres) UpdateReservationStatus(ctx context.Context, tx pgx.Tx, id uuid.UUID, status domain.ReservationStatus) error {
	var extra string
	switch status {
	case domain.ReservationReleased, domain.ReservationExpired:
		extra = ", released_at = now()"
	case domain.ReservationFulfilled:
		extra = ", fulfilled_at = now()"
	}
	query := fmt.Sprintf(`UPDATE stock_reservations SET status = $2%s WHERE id = $1`, extra)
	_, err := tx.Exec(ctx, query, id, status)
	return err
}

func (r *Postgres) ListExpiredReservations(ctx context.Context, limit int) ([]domain.StockReservation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, order_id, order_item_id, sku_id, warehouse_id, inventory_unit_id,
		       quantity, status, expires_at, created_at
		FROM stock_reservations
		WHERE status = 'active' AND expires_at < now()
		ORDER BY expires_at
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.StockReservation
	for rows.Next() {
		var res domain.StockReservation
		if err := rows.Scan(&res.ID, &res.OrderID, &res.OrderItemID, &res.SKUID, &res.WarehouseID,
			&res.InventoryUnitID, &res.Quantity, &res.Status, &res.ExpiresAt, &res.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, res)
	}
	return out, rows.Err()
}

func (r *Postgres) InsertOutbox(ctx context.Context, tx pgx.Tx, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)
	`, eventType, data)
	return err
}

const unitColumns = `
	id, public_code, sku_id, warehouse_id, location_id, status, purchase_id, unit_cost_usd,
	received_at, available_at, sold_at, order_id, order_item_id, reservation_id,
	serial_number, notes, version, created_at, updated_at
`

const unitSelect = `SELECT ` + unitColumns + ` FROM inventory_units`

type unitScanner interface {
	Scan(dest ...any) error
}

func scanUnit(row unitScanner) (*domain.InventoryUnit, error) {
	var u domain.InventoryUnit
	err := row.Scan(
		&u.ID, &u.UnitCode, &u.SKUID, &u.WarehouseID, &u.LocationID, &u.Status,
		&u.PurchaseID, &u.UnitCostUSD, &u.ReceivedAt, &u.AvailableAt, &u.SoldAt,
		&u.OrderID, &u.OrderItemID, &u.ReservationID, &u.SerialNumber, &u.Notes,
		&u.Version, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func scanUnits(rows pgx.Rows) ([]domain.InventoryUnit, error) {
	var out []domain.InventoryUnit
	for rows.Next() {
		var u domain.InventoryUnit
		if err := rows.Scan(
			&u.ID, &u.UnitCode, &u.SKUID, &u.WarehouseID, &u.LocationID, &u.Status,
			&u.PurchaseID, &u.UnitCostUSD, &u.ReceivedAt, &u.AvailableAt, &u.SoldAt,
			&u.OrderID, &u.OrderItemID, &u.ReservationID, &u.SerialNumber, &u.Notes,
			&u.Version, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Postgres) ListBalances(ctx context.Context, warehouseID uuid.UUID, query string, limit, offset int) ([]domain.BalanceListItem, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	query = strings.TrimSpace(strings.ToLower(query))

	var filter string
	var args []any
	args = append(args, warehouseID)
	if query != "" {
		filter = ` AND (LOWER(s.code) LIKE $2 OR LOWER(s.name) LIKE $2 OR LOWER(p.name) LIKE $2)`
		args = append(args, "%"+query+"%")
	}

	countSQL := `
		SELECT COUNT(*)
		FROM stock_balances b
		JOIN skus s ON s.id = b.sku_id
		JOIN products p ON p.id = s.product_id
		WHERE b.warehouse_id = $1` + filter
	var total int
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(args, limit, offset)
	limitIdx := len(listArgs) - 1
	offsetIdx := len(listArgs)
	listSQL := fmt.Sprintf(`
		SELECT b.sku_id, s.code, s.name, b.warehouse_id, b.qty_physical, b.qty_reserved, b.qty_available
		FROM stock_balances b
		JOIN skus s ON s.id = b.sku_id
		JOIN products p ON p.id = s.product_id
		WHERE b.warehouse_id = $1%s
		ORDER BY s.code
		LIMIT $%d OFFSET $%d
	`, filter, limitIdx, offsetIdx)

	rows, err := r.pool.Query(ctx, listSQL, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.BalanceListItem
	for rows.Next() {
		var item domain.BalanceListItem
		if err := rows.Scan(
			&item.SKUID, &item.SKUCode, &item.SKUName, &item.WarehouseID,
			&item.QtyPhysical, &item.QtyReserved, &item.QtyAvailable,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, item)
	}
	return out, total, rows.Err()
}

func (r *Postgres) ListLowStockSKUs(ctx context.Context, threshold, limit, offset int, query string) ([]domain.LowStockSKU, int, error) {
	if threshold <= 0 {
		threshold = 2
	}
	if limit <= 0 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	query = strings.TrimSpace(strings.ToLower(query))

	var filter string
	args := []any{threshold}
	if query != "" {
		filter = ` AND (LOWER(s.code) LIKE $2 OR LOWER(s.name) LIKE $2 OR LOWER(p.name) LIKE $2)`
		args = append(args, "%"+query+"%")
	}

	countSQL := fmt.Sprintf(`
		SELECT COUNT(*)::int FROM (
			SELECT s.id
			FROM skus s
			JOIN products p ON p.id = s.product_id
			LEFT JOIN stock_balances b ON b.sku_id = s.id
			WHERE s.is_active = true%s
			GROUP BY s.id
			HAVING COALESCE(SUM(b.qty_available), 0) <= $1
		) low_stock
	`, filter)
	var total int
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(args, limit, offset)
	limitIdx := len(listArgs) - 1
	offsetIdx := len(listArgs)
	listSQL := fmt.Sprintf(`
		SELECT s.id, s.code, s.name,
			COALESCE(SUM(b.qty_physical), 0)::INT,
			COALESCE(SUM(b.qty_reserved), 0)::INT,
			COALESCE(SUM(b.qty_available), 0)::INT
		FROM skus s
		JOIN products p ON p.id = s.product_id
		LEFT JOIN stock_balances b ON b.sku_id = s.id
		WHERE s.is_active = true%s
		GROUP BY s.id, s.code, s.name
		HAVING COALESCE(SUM(b.qty_available), 0) <= $1
		ORDER BY COALESCE(SUM(b.qty_available), 0) ASC, s.code
		LIMIT $%d OFFSET $%d
	`, filter, limitIdx, offsetIdx)

	rows, err := r.pool.Query(ctx, listSQL, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.LowStockSKU
	for rows.Next() {
		var item domain.LowStockSKU
		if err := rows.Scan(
			&item.SKUID, &item.SKUCode, &item.SKUName,
			&item.QtyPhysical, &item.QtyReserved, &item.QtyAvailable,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, item)
	}
	return out, total, rows.Err()
}

func scanBalance(row pgx.Row) (*domain.StockBalance, error) {
	var b domain.StockBalance
	err := row.Scan(&b.SKUID, &b.WarehouseID, &b.QtyPhysical, &b.QtyReserved, &b.QtyAvailable, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
