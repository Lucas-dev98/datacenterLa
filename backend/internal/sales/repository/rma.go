package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const defaultRMAWarrantyDays = 90

const rmaCaseSelect = `
	SELECT r.id, r.case_number, r.order_id, o.order_number, r.customer_id, cu.name,
	       r.status::text, r.reason, r.test_notes, r.defect_confirmed,
	       r.test_submitted_at, r.test_submitted_by,
	       r.resolution::text, r.notes, r.requested_by, r.approved_by,
	       r.created_at, r.updated_at, o.shipped_at
	FROM rma_cases r
	JOIN orders o ON o.id = r.order_id
	JOIN customers cu ON cu.id = r.customer_id
`

func (r *Postgres) GetOrderShippedAt(ctx context.Context, orderID uuid.UUID) (*time.Time, error) {
	var shippedAt *time.Time
	err := r.pool.QueryRow(ctx, `SELECT shipped_at FROM orders WHERE id = $1`, orderID).Scan(&shippedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return shippedAt, err
}

func (r *Postgres) GetRMAWarrantyDays(ctx context.Context) (int, error) {
	var raw string
	err := r.pool.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = 'rma_warranty_days'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return defaultRMAWarrantyDays, nil
	}
	if err != nil {
		return 0, err
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return defaultRMAWarrantyDays, nil
	}
	return n, nil
}

func (r *Postgres) CreateRMACase(ctx context.Context, in domain.CreateRMAInput) (*domain.RMACase, error) {
	o, err := r.GetOrder(ctx, in.OrderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "shipped" {
		return nil, domain.ErrInvalidState
	}
	testNotes := strings.TrimSpace(in.TestNotes)
	var c domain.RMACase
	err = r.pool.QueryRow(ctx, `
		INSERT INTO rma_cases (
			case_number, order_id, customer_id, reason, test_notes, defect_confirmed,
			test_submitted_at, test_submitted_by, notes, requested_by, status
		)
		VALUES (
			generate_rma_case_number(), $1, $2, $3, $4, $5,
			now(), $6, $7, $6, 'inspecting'::rma_status
		)
		RETURNING id
	`, in.OrderID, o.CustomerID, in.Reason, nullIfEmpty(testNotes), in.DefectConfirmed,
		in.RequestedBy, in.Notes).Scan(&c.ID)
	if err != nil {
		return nil, err
	}
	for _, item := range in.Items {
		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}
		_, err = r.pool.Exec(ctx, `
			INSERT INTO rma_items (rma_case_id, order_item_id, sku_id, inventory_unit_id, quantity, condition_notes)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, c.ID, item.OrderItemID, item.SKUID, item.InventoryUnitID, qty, item.ConditionNotes)
		if err != nil {
			return nil, err
		}
	}
	return r.GetRMACase(ctx, c.ID)
}

func nullIfEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	v := strings.TrimSpace(s)
	return &v
}

func (r *Postgres) AddRMATestPhoto(ctx context.Context, caseID uuid.UUID, path string, createdBy uuid.UUID) (*domain.RMATestPhoto, error) {
	var p domain.RMATestPhoto
	err := r.pool.QueryRow(ctx, `
		INSERT INTO rma_test_photos (rma_case_id, file_path, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, rma_case_id, created_at
	`, caseID, path, createdBy).Scan(&p.ID, &p.RMACaseID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Postgres) GetRMATestPhoto(ctx context.Context, caseID, photoID uuid.UUID) (*domain.RMATestPhoto, string, error) {
	var p domain.RMATestPhoto
	var path string
	err := r.pool.QueryRow(ctx, `
		SELECT id, rma_case_id, file_path, created_at
		FROM rma_test_photos
		WHERE rma_case_id = $1 AND id = $2
	`, caseID, photoID).Scan(&p.ID, &p.RMACaseID, &path, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", domain.ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	return &p, path, nil
}

func (r *Postgres) GetRMACase(ctx context.Context, id uuid.UUID) (*domain.RMACase, error) {
	c, err := r.scanRMACaseRow(r.pool.QueryRow(ctx, rmaCaseSelect+` WHERE r.id = $1`, id))
	if err != nil {
		return nil, err
	}
	c.Items, err = r.listRMAItems(ctx, id)
	if err != nil {
		return nil, err
	}
	c.TestPhotos, err = r.listRMATestPhotos(ctx, id)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Postgres) ListRMACases(ctx context.Context, status, query string, limit int) ([]domain.RMACase, error) {
	if limit <= 0 {
		limit = 30
	}
	query = strings.TrimSpace(query)

	var conditions []string
	var args []any
	if status != "" {
		args = append(args, status)
		conditions = append(conditions, fmt.Sprintf("r.status = $%d::rma_status", len(args)))
	}
	if query != "" {
		likeIdx, digitsIdx, digitLikeIdx, unitCodeIdx := appendOrderSearchArgs(query, &args)
		conditions = append(conditions, fmt.Sprintf(`(
			r.case_number ILIKE $%d
			OR %s
			OR EXISTS (
				SELECT 1 FROM rma_items ri
				JOIN inventory_units u ON u.id = ri.inventory_unit_id
				WHERE ri.rma_case_id = r.id
				  AND (u.public_code ILIKE $%d OR ($%d <> '' AND u.public_code = $%d))
			)
		)`, likeIdx, orderSearchWhere("o.", "cu.", likeIdx, digitsIdx, digitLikeIdx, unitCodeIdx), likeIdx, unitCodeIdx, unitCodeIdx))
	}

	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}
	args = append(args, limit)
	limitIdx := len(args)

	q := rmaCaseSelect + where + fmt.Sprintf(`
		ORDER BY r.created_at DESC LIMIT $%d
	`, limitIdx)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.RMACase
	for rows.Next() {
		c, err := r.scanRMACaseRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Postgres) scanRMACaseRow(row pgx.Row) (*domain.RMACase, error) {
	var c domain.RMACase
	var shippedAt *time.Time
	if err := row.Scan(
		&c.ID, &c.CaseNumber, &c.OrderID, &c.OrderNumber, &c.CustomerID, &c.CustomerName,
		&c.Status, &c.Reason, &c.TestNotes, &c.DefectConfirmed,
		&c.TestSubmittedAt, &c.TestSubmittedBy,
		&c.Resolution, &c.Notes, &c.RequestedBy, &c.ApprovedBy,
		&c.CreatedAt, &c.UpdatedAt, &shippedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	warrantyDays, err := r.GetRMAWarrantyDays(context.Background())
	if err != nil {
		return nil, err
	}
	applyWarrantyMeta(&c, warrantyDays, shippedAt)
	return &c, nil
}

func applyWarrantyMeta(c *domain.RMACase, warrantyDays int, shippedAt *time.Time) {
	c.WarrantyDays = warrantyDays
	if shippedAt == nil || shippedAt.IsZero() {
		c.WithinWarranty = false
		return
	}
	expires := shippedAt.AddDate(0, 0, warrantyDays)
	c.WarrantyExpiresAt = &expires
	c.WithinWarranty = !time.Now().UTC().After(expires)
}

func (r *Postgres) listRMATestPhotos(ctx context.Context, caseID uuid.UUID) ([]domain.RMATestPhoto, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, rma_case_id, created_at
		FROM rma_test_photos
		WHERE rma_case_id = $1
		ORDER BY created_at
	`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.RMATestPhoto
	for rows.Next() {
		var p domain.RMATestPhoto
		if err := rows.Scan(&p.ID, &p.RMACaseID, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) CountRMATestPhotos(ctx context.Context, caseID uuid.UUID) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM rma_test_photos WHERE rma_case_id = $1`, caseID).Scan(&n)
	return n, err
}

func (r *Postgres) listRMAItems(ctx context.Context, caseID uuid.UUID) ([]domain.RMAItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i.rma_case_id, i.order_item_id, i.sku_id, s.code, i.inventory_unit_id, i.quantity, i.condition_notes
		FROM rma_items i
		JOIN skus s ON s.id = i.sku_id
		WHERE i.rma_case_id = $1
	`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.RMAItem
	for rows.Next() {
		var item domain.RMAItem
		if err := rows.Scan(&item.ID, &item.RMACaseID, &item.OrderItemID, &item.SKUID, &item.SKUCode,
			&item.InventoryUnitID, &item.Quantity, &item.ConditionNotes); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) UpdateRMAStatus(ctx context.Context, id uuid.UUID, status string, approvedBy *uuid.UUID, resolution *string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE rma_cases SET status = $2::rma_status, approved_by = COALESCE($3, approved_by),
			resolution = COALESCE($4::rma_resolution, resolution), updated_at = now()
		WHERE id = $1
	`, id, status, approvedBy, resolution)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
