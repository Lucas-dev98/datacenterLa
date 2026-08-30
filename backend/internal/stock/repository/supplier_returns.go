package repository

import (
	"context"
	"errors"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) InsertIntakeTestPhoto(ctx context.Context, unitID uuid.UUID, filePath string, createdBy uuid.UUID) (*domain.IntakeTestPhoto, error) {
	var p domain.IntakeTestPhoto
	err := r.pool.QueryRow(ctx, `
		INSERT INTO intake_test_photos (inventory_unit_id, file_path, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, inventory_unit_id, file_path, created_at
	`, unitID, filePath, createdBy).Scan(&p.ID, &p.InventoryUnitID, &p.FilePath, &p.CreatedAt)
	return &p, err
}

func (r *Postgres) GetIntakeTestPhoto(ctx context.Context, unitID, photoID uuid.UUID) (string, error) {
	var path string
	err := r.pool.QueryRow(ctx, `
		SELECT file_path FROM intake_test_photos WHERE id = $1 AND inventory_unit_id = $2
	`, photoID, unitID).Scan(&path)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return path, err
}

func (r *Postgres) InsertSupplierReturn(ctx context.Context, req *domain.SupplierReturnRequest, createdBy uuid.UUID) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO supplier_return_requests (
			supplier_id, purchase_order_id, inventory_unit_id, sku_id, reason, created_by
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, req.SupplierID, req.PurchaseOrderID, req.InventoryUnitID, req.SKUID, req.Reason, createdBy).
		Scan(&req.ID, &req.CreatedAt)
}

func (r *Postgres) ListSupplierReturns(ctx context.Context, status string, limit int) ([]domain.SupplierReturnRequest, error) {
	if limit <= 0 {
		limit = 50
	}
	base := `
		SELECT sr.id, sr.supplier_id, COALESCE(NULLIF(s.legal_name, ''), s.name),
		       sr.purchase_order_id, COALESCE(p.po_number, ''),
		       sr.inventory_unit_id, COALESCE(u.public_code, ''),
		       sr.sku_id, COALESCE(sk.code, ''),
		       sr.reason, sr.status::text, sr.created_at
		FROM supplier_return_requests sr
		JOIN suppliers s ON s.id = sr.supplier_id
		LEFT JOIN purchase_orders p ON p.id = sr.purchase_order_id
		LEFT JOIN inventory_units u ON u.id = sr.inventory_unit_id
		LEFT JOIN skus sk ON sk.id = sr.sku_id
	`
	var rows pgx.Rows
	var err error
	if status != "" {
		rows, err = r.pool.Query(ctx, base+` WHERE sr.status = $1::supplier_return_status ORDER BY sr.created_at DESC LIMIT $2`, status, limit)
	} else {
		rows, err = r.pool.Query(ctx, base+` ORDER BY sr.created_at DESC LIMIT $1`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.SupplierReturnRequest
	for rows.Next() {
		var item domain.SupplierReturnRequest
		if err := rows.Scan(
			&item.ID, &item.SupplierID, &item.SupplierName,
			&item.PurchaseOrderID, &item.PONumber,
			&item.InventoryUnitID, &item.UnitCode,
			&item.SKUID, &item.SKUCode,
			&item.Reason, &item.Status, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) GetSupplierReturnByID(ctx context.Context, id uuid.UUID) (*domain.SupplierReturnRequest, error) {
	var item domain.SupplierReturnRequest
	err := r.pool.QueryRow(ctx, `
		SELECT sr.id, sr.supplier_id, COALESCE(NULLIF(s.legal_name, ''), s.name),
		       sr.purchase_order_id, COALESCE(p.po_number, ''),
		       sr.inventory_unit_id, COALESCE(u.public_code, ''),
		       sr.sku_id, COALESCE(sk.code, ''),
		       sr.reason, sr.status::text, sr.created_at
		FROM supplier_return_requests sr
		JOIN suppliers s ON s.id = sr.supplier_id
		LEFT JOIN purchase_orders p ON p.id = sr.purchase_order_id
		LEFT JOIN inventory_units u ON u.id = sr.inventory_unit_id
		LEFT JOIN skus sk ON sk.id = sr.sku_id
		WHERE sr.id = $1
	`, id).Scan(
		&item.ID, &item.SupplierID, &item.SupplierName,
		&item.PurchaseOrderID, &item.PONumber,
		&item.InventoryUnitID, &item.UnitCode,
		&item.SKUID, &item.SKUCode,
		&item.Reason, &item.Status, &item.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Postgres) UpdateSupplierReturnStatus(ctx context.Context, id uuid.UUID, status string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE supplier_return_requests
		SET status = $2::supplier_return_status, updated_at = now()
		WHERE id = $1
	`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) GetPurchaseOrderSupplier(ctx context.Context, poID uuid.UUID) (uuid.UUID, string, error) {
	var supplierID uuid.UUID
	var name string
	err := r.pool.QueryRow(ctx, `
		SELECT p.supplier_id, COALESCE(NULLIF(s.legal_name, ''), s.name)
		FROM purchase_orders p
		JOIN suppliers s ON s.id = p.supplier_id
		WHERE p.id = $1
	`, poID).Scan(&supplierID, &name)
	return supplierID, name, err
}
