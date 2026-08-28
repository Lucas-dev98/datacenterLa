package repository

import (
	"context"
	"errors"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) InsertIntakeBatch(ctx context.Context, tx pgx.Tx, batch *domain.IntakeBatch, createdBy uuid.UUID) error {
	return tx.QueryRow(ctx, `
		INSERT INTO stock_intake_batches (
			warehouse_id, sku_id, quantity, first_unit_code, last_unit_code, purchase_id, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`, batch.WarehouseID, batch.SKUID, batch.Quantity, batch.FirstUnitCode, batch.LastUnitCode,
		batch.PurchaseID, createdBy,
	).Scan(&batch.ID, &batch.CreatedAt)
}

func (r *Postgres) UpdateIntakeBatchCodes(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, first, last string) error {
	_, err := tx.Exec(ctx, `
		UPDATE stock_intake_batches SET first_unit_code = $2, last_unit_code = $3 WHERE id = $1
	`, batchID, first, last)
	return err
}

func (r *Postgres) InsertIntakeBatchPhoto(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, filePath string, sortOrder int) (*domain.IntakeBatchPhoto, error) {
	var photo domain.IntakeBatchPhoto
	err := tx.QueryRow(ctx, `
		INSERT INTO stock_intake_batch_photos (batch_id, file_path, sort_order)
		VALUES ($1, $2, $3)
		RETURNING id, batch_id, sort_order, created_at
	`, batchID, filePath, sortOrder).Scan(&photo.ID, &photo.BatchID, &photo.SortOrder, &photo.CreatedAt)
	return &photo, err
}

func (r *Postgres) ListIntakeBatchPhotos(ctx context.Context, batchID uuid.UUID) ([]domain.IntakeBatchPhoto, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, batch_id, sort_order, created_at
		FROM stock_intake_batch_photos
		WHERE batch_id = $1
		ORDER BY sort_order, created_at
	`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.IntakeBatchPhoto
	for rows.Next() {
		var p domain.IntakeBatchPhoto
		if err := rows.Scan(&p.ID, &p.BatchID, &p.SortOrder, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) GetIntakeBatchPhoto(ctx context.Context, batchID, photoID uuid.UUID) (filePath string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT file_path FROM stock_intake_batch_photos WHERE id = $1 AND batch_id = $2
	`, photoID, batchID).Scan(&filePath)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return filePath, err
}
