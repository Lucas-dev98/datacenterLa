package repository

import (
	"context"
	"encoding/json"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) GetHealthDashboard(ctx context.Context) (*domain.HealthDashboard, error) {
	var d domain.HealthDashboard
	err := r.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM inventory_units),
			(SELECT COUNT(*)::int FROM inventory_units WHERE status = 'available'),
			(SELECT COUNT(*)::int FROM inventory_units WHERE status = 'reserved'),
			(SELECT COUNT(*)::int FROM stock_health_issues WHERE status = 'open'),
			(SELECT COUNT(*)::int FROM stock_reservations WHERE status = 'active' AND expires_at <= now() + interval '24 hours'),
			(SELECT COUNT(*)::int FROM stock_balances WHERE qty_available <= 2 AND qty_physical > 0)
	`).Scan(&d.TotalUnits, &d.AvailableUnits, &d.ReservedUnits, &d.OpenIssues,
		&d.ExpiringReservations, &d.LowStockSKUs)
	if err != nil {
		return nil, err
	}
	d.UnitsByStatus = map[string]int{}
	rows, err := r.pool.Query(ctx, `
		SELECT status::text, COUNT(*)::int FROM inventory_units GROUP BY status ORDER BY status
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			return nil, err
		}
		d.UnitsByStatus[status] = n
	}
	return &d, rows.Err()
}

func (r *Postgres) ListExpiringReservations(ctx context.Context, withinHours int, limit int) ([]domain.ExpiringReservation, error) {
	if withinHours <= 0 {
		withinHours = 48
	}
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, `
		SELECT sr.id, sr.order_id, o.order_number, sr.sku_id, s.code, sr.expires_at
		FROM stock_reservations sr
		JOIN skus s ON s.id = sr.sku_id
		LEFT JOIN orders o ON o.id = sr.order_id
		WHERE sr.status = 'active'
		  AND sr.expires_at <= now() + make_interval(hours => $1)
		ORDER BY sr.expires_at
		LIMIT $2
	`, withinHours, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ExpiringReservation
	for rows.Next() {
		var item domain.ExpiringReservation
		if err := rows.Scan(&item.ID, &item.OrderID, &item.OrderNumber, &item.SKUID, &item.SKUCode, &item.ExpiresAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) ListHealthIssues(ctx context.Context, status string, limit int) ([]domain.HealthIssue, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows pgx.Rows
	var err error
	if status != "" {
		rows, err = r.pool.Query(ctx, `
			SELECT h.id, h.issue_type::text, h.status::text, h.inventory_unit_id,
			       u.public_code, h.sku_id, s.code, h.warehouse_id, h.details, h.detected_at,
			       h.resolved_at, h.resolution_notes
			FROM stock_health_issues h
			LEFT JOIN inventory_units u ON u.id = h.inventory_unit_id
			LEFT JOIN skus s ON s.id = h.sku_id
			WHERE h.status = $1::health_issue_status
			ORDER BY h.detected_at DESC LIMIT $2
		`, status, limit)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT h.id, h.issue_type::text, h.status::text, h.inventory_unit_id,
			       u.public_code, h.sku_id, s.code, h.warehouse_id, h.details, h.detected_at,
			       h.resolved_at, h.resolution_notes
			FROM stock_health_issues h
			LEFT JOIN inventory_units u ON u.id = h.inventory_unit_id
			LEFT JOIN skus s ON s.id = h.sku_id
			ORDER BY h.detected_at DESC LIMIT $1
		`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanHealthIssues(rows)
}

func scanHealthIssues(rows pgx.Rows) ([]domain.HealthIssue, error) {
	var out []domain.HealthIssue
	for rows.Next() {
		var h domain.HealthIssue
		if err := rows.Scan(&h.ID, &h.IssueType, &h.Status, &h.InventoryUnitID,
			&h.UnitCode, &h.SKUID, &h.SKUCode, &h.WarehouseID, &h.Details,
			&h.DetectedAt, &h.ResolvedAt, &h.ResolutionNotes); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *Postgres) ResolveHealthIssue(ctx context.Context, id, resolvedBy uuid.UUID, notes string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE stock_health_issues
		SET status = 'resolved', resolved_at = now(), resolved_by = $2, resolution_notes = $3
		WHERE id = $1 AND status = 'open'
	`, id, resolvedBy, notes)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) InsertHealthIssue(ctx context.Context, issueType string, unitID, skuID, warehouseID *uuid.UUID, details map[string]any) error {
	raw, _ := json.Marshal(details)
	_, err := r.pool.Exec(ctx, `
		INSERT INTO stock_health_issues (issue_type, inventory_unit_id, sku_id, warehouse_id, details)
		SELECT $1::health_issue_type, $2, $3, $4, $5
		WHERE NOT EXISTS (
			SELECT 1 FROM stock_health_issues
			WHERE status = 'open' AND issue_type = $1::health_issue_type
			  AND (($2::uuid IS NOT NULL AND inventory_unit_id = $2) OR ($2 IS NULL AND inventory_unit_id IS NULL))
		)
	`, issueType, unitID, skuID, warehouseID, raw)
	return err
}

func (r *Postgres) ScanHealthIssues(ctx context.Context) (int, error) {
	inserted := 0

	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.sku_id, u.warehouse_id, u.public_code
		FROM inventory_units u
		WHERE u.status = 'available' AND u.location_id IS NULL
	`)
	if err != nil {
		return 0, err
	}
	for rows.Next() {
		var unitID, skuID, whID uuid.UUID
		var code string
		if err := rows.Scan(&unitID, &skuID, &whID, &code); err != nil {
			rows.Close()
			return inserted, err
		}
		if err := r.InsertHealthIssue(ctx, "missing_location", &unitID, &skuID, &whID, map[string]any{"unit_code": code}); err != nil {
			rows.Close()
			return inserted, err
		}
		inserted++
	}
	rows.Close()

	rows2, err := r.pool.Query(ctx, `
		SELECT sr.id, sr.order_id, sr.sku_id, sr.inventory_unit_id
		FROM stock_reservations sr
		WHERE sr.status = 'active' AND sr.expires_at < now()
	`)
	if err != nil {
		return inserted, err
	}
	for rows2.Next() {
		var resID, orderID, skuID uuid.UUID
		var unitID *uuid.UUID
		if err := rows2.Scan(&resID, &orderID, &skuID, &unitID); err != nil {
			rows2.Close()
			return inserted, err
		}
		if err := r.InsertHealthIssue(ctx, "reservation_orphan", unitID, &skuID, nil, map[string]any{
			"reservation_id": resID, "order_id": orderID,
		}); err != nil {
			rows2.Close()
			return inserted, err
		}
		inserted++
	}
	rows2.Close()
	return inserted, nil
}
