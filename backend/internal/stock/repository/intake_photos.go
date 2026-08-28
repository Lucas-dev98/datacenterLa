package repository

import (
	"context"
	"errors"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) InsertUnitIntakePhoto(ctx context.Context, tx pgx.Tx, unitID uuid.UUID, filePath string, createdBy uuid.UUID) (*domain.UnitIntakePhoto, error) {
	var photo domain.UnitIntakePhoto
	err := tx.QueryRow(ctx, `
		INSERT INTO inventory_unit_intake_photos (inventory_unit_id, file_path, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, inventory_unit_id, file_path, created_at
	`, unitID, filePath, createdBy).Scan(&photo.ID, &photo.InventoryUnitID, &photo.FilePath, &photo.CreatedAt)
	return &photo, err
}

func (r *Postgres) GetUnitIntakePhoto(ctx context.Context, unitID uuid.UUID) (*domain.UnitIntakePhoto, error) {
	var photo domain.UnitIntakePhoto
	err := r.pool.QueryRow(ctx, `
		SELECT id, inventory_unit_id, file_path, created_at
		FROM inventory_unit_intake_photos
		WHERE inventory_unit_id = $1
	`, unitID).Scan(&photo.ID, &photo.InventoryUnitID, &photo.FilePath, &photo.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &photo, err
}
