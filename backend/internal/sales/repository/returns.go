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

const defaultReturnWindowDays = 7

const returnSelect = `
	SELECT cr.id, cr.return_number, cr.order_id, o.order_number, cr.customer_id, cu.name,
	       cr.status::text, cr.reason, cr.condition_notes,
	       cr.resolution::text, cr.notes, cr.requested_by, cr.approved_by,
	       cr.created_at, cr.updated_at, o.shipped_at
	FROM customer_returns cr
	JOIN orders o ON o.id = cr.order_id
	JOIN customers cu ON cu.id = cr.customer_id
`

func (r *Postgres) GetReturnWindowDays(ctx context.Context) (int, error) {
	var raw string
	err := r.pool.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = 'return_window_days'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return defaultReturnWindowDays, nil
	}
	if err != nil {
		return 0, err
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return defaultReturnWindowDays, nil
	}
	return n, nil
}

func (r *Postgres) CreateCustomerReturn(ctx context.Context, in domain.CreateCustomerReturnInput) (*domain.CustomerReturn, error) {
	o, err := r.GetOrder(ctx, in.OrderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "shipped" {
		return nil, domain.ErrInvalidState
	}
	var id uuid.UUID
	err = r.pool.QueryRow(ctx, `
		INSERT INTO customer_returns (return_number, order_id, customer_id, reason, condition_notes, notes, requested_by)
		VALUES (generate_customer_return_number(), $1, $2, $3, $4, $5, $6)
		RETURNING id
	`, in.OrderID, o.CustomerID, in.Reason, in.ConditionNotes, in.Notes, in.RequestedBy).Scan(&id)
	if err != nil {
		return nil, err
	}
	for _, item := range in.Items {
		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}
		_, err = r.pool.Exec(ctx, `
			INSERT INTO customer_return_items (return_id, order_item_id, sku_id, inventory_unit_id, quantity, condition_notes)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, id, item.OrderItemID, item.SKUID, item.InventoryUnitID, qty, item.ConditionNotes)
		if err != nil {
			return nil, err
		}
	}
	return r.GetCustomerReturn(ctx, id)
}

func (r *Postgres) AddCustomerReturnPhoto(ctx context.Context, returnID uuid.UUID, path string, createdBy uuid.UUID) (*domain.CustomerReturnPhoto, error) {
	var p domain.CustomerReturnPhoto
	err := r.pool.QueryRow(ctx, `
		INSERT INTO customer_return_photos (return_id, file_path, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, return_id, created_at
	`, returnID, path, createdBy).Scan(&p.ID, &p.ReturnID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Postgres) GetCustomerReturnPhoto(ctx context.Context, returnID, photoID uuid.UUID) (*domain.CustomerReturnPhoto, string, error) {
	var p domain.CustomerReturnPhoto
	var path string
	err := r.pool.QueryRow(ctx, `
		SELECT id, return_id, file_path, created_at
		FROM customer_return_photos
		WHERE return_id = $1 AND id = $2
	`, returnID, photoID).Scan(&p.ID, &p.ReturnID, &path, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", domain.ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	return &p, path, nil
}

func (r *Postgres) GetCustomerReturn(ctx context.Context, id uuid.UUID) (*domain.CustomerReturn, error) {
	ret, err := r.scanCustomerReturnRow(r.pool.QueryRow(ctx, returnSelect+` WHERE cr.id = $1`, id))
	if err != nil {
		return nil, err
	}
	ret.Items, err = r.listCustomerReturnItems(ctx, id)
	if err != nil {
		return nil, err
	}
	ret.Photos, err = r.listCustomerReturnPhotos(ctx, id)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *Postgres) ListCustomerReturns(ctx context.Context, status, query string, limit int) ([]domain.CustomerReturn, error) {
	if limit <= 0 {
		limit = 30
	}
	query = strings.TrimSpace(query)

	var conditions []string
	var args []any
	if status != "" {
		args = append(args, status)
		conditions = append(conditions, fmt.Sprintf("cr.status = $%d::customer_return_status", len(args)))
	}
	if query != "" {
		likeIdx, digitsIdx, digitLikeIdx, unitCodeIdx := appendOrderSearchArgs(query, &args)
		conditions = append(conditions, fmt.Sprintf(`(
			cr.return_number ILIKE $%d
			OR %s
			OR EXISTS (
				SELECT 1 FROM customer_return_items cri
				JOIN inventory_units u ON u.id = cri.inventory_unit_id
				WHERE cri.return_id = cr.id
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

	q := returnSelect + where + fmt.Sprintf(`
		ORDER BY cr.created_at DESC LIMIT $%d
	`, limitIdx)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CustomerReturn
	for rows.Next() {
		ret, err := r.scanCustomerReturnRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *ret)
	}
	return out, rows.Err()
}

func (r *Postgres) scanCustomerReturnRow(row pgx.Row) (*domain.CustomerReturn, error) {
	var ret domain.CustomerReturn
	var shippedAt *time.Time
	if err := row.Scan(
		&ret.ID, &ret.ReturnNumber, &ret.OrderID, &ret.OrderNumber, &ret.CustomerID, &ret.CustomerName,
		&ret.Status, &ret.Reason, &ret.ConditionNotes,
		&ret.Resolution, &ret.Notes, &ret.RequestedBy, &ret.ApprovedBy,
		&ret.CreatedAt, &ret.UpdatedAt, &shippedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	windowDays, err := r.GetReturnWindowDays(context.Background())
	if err != nil {
		return nil, err
	}
	applyReturnWindowMeta(&ret, windowDays, shippedAt)
	return &ret, nil
}

func applyReturnWindowMeta(ret *domain.CustomerReturn, windowDays int, shippedAt *time.Time) {
	ret.ReturnWindowDays = windowDays
	if shippedAt == nil || shippedAt.IsZero() {
		ret.WithinReturnWindow = false
		return
	}
	expires := shippedAt.AddDate(0, 0, windowDays)
	ret.ReturnExpiresAt = &expires
	ret.WithinReturnWindow = !time.Now().UTC().After(expires)
}

func (r *Postgres) listCustomerReturnPhotos(ctx context.Context, returnID uuid.UUID) ([]domain.CustomerReturnPhoto, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, return_id, created_at
		FROM customer_return_photos
		WHERE return_id = $1
		ORDER BY created_at
	`, returnID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CustomerReturnPhoto
	for rows.Next() {
		var p domain.CustomerReturnPhoto
		if err := rows.Scan(&p.ID, &p.ReturnID, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) listCustomerReturnItems(ctx context.Context, returnID uuid.UUID) ([]domain.CustomerReturnItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i.return_id, i.order_item_id, i.sku_id, s.code, i.inventory_unit_id, i.quantity, i.condition_notes
		FROM customer_return_items i
		JOIN skus s ON s.id = i.sku_id
		WHERE i.return_id = $1
	`, returnID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CustomerReturnItem
	for rows.Next() {
		var item domain.CustomerReturnItem
		if err := rows.Scan(&item.ID, &item.ReturnID, &item.OrderItemID, &item.SKUID, &item.SKUCode,
			&item.InventoryUnitID, &item.Quantity, &item.ConditionNotes); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) UpdateCustomerReturnStatus(ctx context.Context, id uuid.UUID, status string, approvedBy, resolvedBy *uuid.UUID, resolution *string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE customer_returns SET status = $2::customer_return_status,
			approved_by = COALESCE($3, approved_by),
			resolved_by = COALESCE($4, resolved_by),
			resolution = COALESCE($5::customer_return_resolution, resolution),
			updated_at = now()
		WHERE id = $1
	`, id, status, approvedBy, resolvedBy, resolution)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
