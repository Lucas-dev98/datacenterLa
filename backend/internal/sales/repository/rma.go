package repository

import (
	"context"
	"errors"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) CreateRMACase(ctx context.Context, in domain.CreateRMAInput) (*domain.RMACase, error) {
	o, err := r.GetOrder(ctx, in.OrderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "shipped" {
		return nil, domain.ErrInvalidState
	}
	var c domain.RMACase
	err = r.pool.QueryRow(ctx, `
		INSERT INTO rma_cases (case_number, order_id, customer_id, reason, notes, requested_by)
		VALUES (generate_rma_case_number(), $1, $2, $3, $4, $5)
		RETURNING id, case_number, order_id, customer_id, status::text, reason, notes, requested_by, created_at, updated_at
	`, in.OrderID, o.CustomerID, in.Reason, in.Notes, in.RequestedBy).Scan(
		&c.ID, &c.CaseNumber, &c.OrderID, &c.CustomerID, &c.Status, &c.Reason, &c.Notes,
		&c.RequestedBy, &c.CreatedAt, &c.UpdatedAt,
	)
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

func (r *Postgres) GetRMACase(ctx context.Context, id uuid.UUID) (*domain.RMACase, error) {
	var c domain.RMACase
	err := r.pool.QueryRow(ctx, `
		SELECT r.id, r.case_number, r.order_id, o.order_number, r.customer_id, cu.name,
		       r.status::text, r.reason, r.resolution::text, r.notes, r.requested_by, r.approved_by,
		       r.created_at, r.updated_at
		FROM rma_cases r
		JOIN orders o ON o.id = r.order_id
		JOIN customers cu ON cu.id = r.customer_id
		WHERE r.id = $1
	`, id).Scan(&c.ID, &c.CaseNumber, &c.OrderID, &c.OrderNumber, &c.CustomerID, &c.CustomerName,
		&c.Status, &c.Reason, &c.Resolution, &c.Notes, &c.RequestedBy, &c.ApprovedBy,
		&c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.Items, err = r.listRMAItems(ctx, id)
	return &c, err
}

func (r *Postgres) ListRMACases(ctx context.Context, status string, limit int) ([]domain.RMACase, error) {
	if limit <= 0 {
		limit = 30
	}
	var rows pgx.Rows
	var err error
	if status != "" {
		rows, err = r.pool.Query(ctx, `
			SELECT r.id, r.case_number, r.order_id, o.order_number, r.customer_id, cu.name,
			       r.status::text, r.reason, r.resolution::text, r.notes, r.requested_by, r.approved_by,
			       r.created_at, r.updated_at
			FROM rma_cases r
			JOIN orders o ON o.id = r.order_id
			JOIN customers cu ON cu.id = r.customer_id
			WHERE r.status = $1::rma_status
			ORDER BY r.created_at DESC LIMIT $2
		`, status, limit)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT r.id, r.case_number, r.order_id, o.order_number, r.customer_id, cu.name,
			       r.status::text, r.reason, r.resolution::text, r.notes, r.requested_by, r.approved_by,
			       r.created_at, r.updated_at
			FROM rma_cases r
			JOIN orders o ON o.id = r.order_id
			JOIN customers cu ON cu.id = r.customer_id
			ORDER BY r.created_at DESC LIMIT $1
		`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.RMACase
	for rows.Next() {
		var c domain.RMACase
		if err := rows.Scan(&c.ID, &c.CaseNumber, &c.OrderID, &c.OrderNumber, &c.CustomerID, &c.CustomerName,
			&c.Status, &c.Reason, &c.Resolution, &c.Notes, &c.RequestedBy, &c.ApprovedBy,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
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
