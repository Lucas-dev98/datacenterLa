package service

import (
	"context"
	"path/filepath"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/platform/storage"
	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const maxBatchPhotos = 5

type ReceiveIntakeItemInput struct {
	SKUID       uuid.UUID
	Quantity    int
	UnitCostUSD *float64
	PurchaseID  *uuid.UUID
}

type ReceiveIntakeInput struct {
	WarehouseID uuid.UUID
	PurchaseID  *uuid.UUID
	Items       []ReceiveIntakeItemInput
	BatchPhotos []domain.IntakePhotoUpload
	CreatedBy   uuid.UUID
}

func (s *Service) ListNextUnitCodes(ctx context.Context, count int) ([]string, error) {
	if count <= 0 || count > 100 {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.PeekNextUnitCodes(ctx, count)
}

func (s *Service) ReceiveWithIntake(ctx context.Context, in ReceiveIntakeInput) ([]domain.InventoryUnit, error) {
	if in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	if len(in.BatchPhotos) == 0 {
		return nil, domain.NewRuleViolation("PHOTO_REQUIRED", "pelo menos uma foto do lote é obrigatória")
	}
	if len(in.BatchPhotos) > maxBatchPhotos {
		return nil, domain.ErrInvalidInput
	}

	var created []domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		return s.receiveIntakeInTx(ctx, tx, in, &created)
	})
	return created, err
}

func (s *Service) ReceiveWithIntakeTx(ctx context.Context, tx pgx.Tx, in ReceiveIntakeInput) ([]domain.InventoryUnit, error) {
	if in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	if len(in.BatchPhotos) == 0 {
		return nil, domain.NewRuleViolation("PHOTO_REQUIRED", "pelo menos uma foto do lote é obrigatória")
	}
	if len(in.BatchPhotos) > maxBatchPhotos {
		return nil, domain.ErrInvalidInput
	}
	var created []domain.InventoryUnit
	if err := s.receiveIntakeInTx(ctx, tx, in, &created); err != nil {
		return nil, err
	}
	return created, nil
}

func (s *Service) receiveIntakeInTx(ctx context.Context, tx pgx.Tx, in ReceiveIntakeInput, created *[]domain.InventoryUnit) error {
	now := time.Now().UTC()
	for _, item := range in.Items {
			if item.SKUID == uuid.Nil || item.Quantity <= 0 {
				return domain.ErrInvalidInput
			}

			batch := domain.IntakeBatch{
				WarehouseID: in.WarehouseID,
				SKUID:       item.SKUID,
				Quantity:    item.Quantity,
				PurchaseID:  coalescePurchase(in.PurchaseID, item.PurchaseID),
			}
			if err := s.repo.InsertIntakeBatch(ctx, tx, &batch, in.CreatedBy); err != nil {
				return err
			}

			var batchUnits []domain.InventoryUnit
			for i := 0; i < item.Quantity; i++ {
				batchID := batch.ID
				unit := domain.InventoryUnit{
					SKUID:         item.SKUID,
					WarehouseID:   in.WarehouseID,
					Status:        domain.StatusReceived,
					PurchaseID:    batch.PurchaseID,
					UnitCostUSD:   item.UnitCostUSD,
					ReceivedAt:    &now,
					IntakeBatchID: &batchID,
				}
				if err := s.repo.CreateUnit(ctx, tx, &unit); err != nil {
					return err
				}
				before := domain.StatusReceived
				refType := "purchase"
				refID := unit.PurchaseID
				mov := domain.StockMovement{
					MovementType:    domain.MovementStatusChange,
					SKUID:           unit.SKUID,
					WarehouseID:     unit.WarehouseID,
					InventoryUnitID: &unit.ID,
					Quantity:        0,
					StatusBefore:    &before,
					StatusAfter:     &unit.Status,
					ReferenceType:   &refType,
					ReferenceID:     refID,
					CreatedBy:       in.CreatedBy,
				}
				if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
					return err
				}
				if err := s.repo.InsertOutbox(ctx, tx, "stock.unit.created", map[string]any{
					"unit_id": unit.ID, "sku_id": unit.SKUID, "warehouse_id": unit.WarehouseID,
				}); err != nil {
					return err
				}
				batchUnits = append(batchUnits, unit)
				*created = append(*created, unit)
			}

			if len(batchUnits) > 0 {
				first := batchUnits[0].UnitCode
				last := batchUnits[len(batchUnits)-1].UnitCode
				if err := s.repo.UpdateIntakeBatchCodes(ctx, tx, batch.ID, first, last); err != nil {
					return err
				}
			}

			for i, photo := range in.BatchPhotos {
				if len(photo.Body) == 0 {
					return domain.ErrInvalidInput
				}
				photoID := uuid.New()
				path, err := storage.SaveIntakeBatchPhoto(batch.ID, photoID, photo.Ext, photo.Body)
				if err != nil {
					return err
				}
				if _, err := s.repo.InsertIntakeBatchPhoto(ctx, tx, batch.ID, path, i); err != nil {
					return err
				}
			}
		}
	return nil
}

func (s *Service) ListIntakeBatchPhotos(ctx context.Context, batchID uuid.UUID) ([]domain.IntakeBatchPhoto, error) {
	return s.repo.ListIntakeBatchPhotos(ctx, batchID)
}

func (s *Service) GetIntakeBatchPhotoFile(ctx context.Context, batchID, photoID uuid.UUID) ([]byte, string, error) {
	filePath, err := s.repo.GetIntakeBatchPhoto(ctx, batchID, photoID)
	if err != nil {
		return nil, "", err
	}
	body, err := storage.ReadDataFile(filePath)
	if err != nil {
		return nil, "", err
	}
	switch strings.ToLower(strings.TrimPrefix(filepath.Ext(filePath), ".")) {
	case "png":
		return body, "image/png", nil
	case "webp":
		return body, "image/webp", nil
	default:
		return body, "image/jpeg", nil
	}
}

func (s *Service) GetUnitIntakePhotoFile(ctx context.Context, unitID uuid.UUID) ([]byte, string, error) {
	photo, err := s.repo.GetUnitIntakePhoto(ctx, unitID)
	if err != nil {
		return nil, "", err
	}
	body, err := storage.ReadDataFile(photo.FilePath)
	if err != nil {
		return nil, "", err
	}
	switch strings.ToLower(strings.TrimPrefix(filepath.Ext(photo.FilePath), ".")) {
	case "png":
		return body, "image/png", nil
	case "webp":
		return body, "image/webp", nil
	default:
		return body, "image/jpeg", nil
	}
}

func PhotoExtFromUpload(filename, contentType string) string {
	ext := strings.TrimPrefix(filepath.Ext(filename), ".")
	if ext == "" {
		switch contentType {
		case "image/png":
			return "png"
		case "image/webp":
			return "webp"
		default:
			return "jpg"
		}
	}
	if ext == "jpeg" {
		return "jpg"
	}
	return ext
}
