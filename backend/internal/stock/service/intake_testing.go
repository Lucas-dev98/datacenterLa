package service

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/datacenterla/platform/internal/platform/storage"
	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
)

const maxTestPhotos = 5

func (s *Service) saveIntakeTestPhotos(ctx context.Context, unitID uuid.UUID, photos []domain.IntakePhotoUpload, createdBy uuid.UUID) error {
	if len(photos) == 0 {
		return domain.NewRuleViolation("PHOTO_REQUIRED", "pelo menos uma foto de teste é obrigatória")
	}
	if len(photos) > maxTestPhotos {
		return domain.ErrInvalidInput
	}
	for _, photo := range photos {
		if len(photo.Body) == 0 {
			return domain.ErrInvalidInput
		}
		photoID := uuid.New()
		path, err := storage.SaveIntakeTestPhoto(unitID, photoID, photo.Ext, photo.Body)
		if err != nil {
			return err
		}
		if _, err := s.repo.InsertIntakeTestPhoto(ctx, unitID, path, createdBy); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) PassIntakeTest(ctx context.Context, unitID uuid.UUID, photos []domain.IntakePhotoUpload, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	u, err := s.repo.GetUnitByID(ctx, unitID)
	if err != nil {
		return nil, err
	}
	if u.Status != domain.StatusInspecting {
		return nil, domain.ErrInvalidTransition
	}
	if err := s.saveIntakeTestPhotos(ctx, unitID, photos, createdBy); err != nil {
		return nil, err
	}
	return s.TransitionUnit(ctx, unitID, domain.StatusIdentified, createdBy, nil)
}

func (s *Service) FailIntakeTest(ctx context.Context, unitID uuid.UUID, reason string, photos []domain.IntakePhotoUpload, createdBy uuid.UUID) (*domain.SupplierReturnRequest, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, domain.ErrInvalidInput
	}
	u, err := s.repo.GetUnitByID(ctx, unitID)
	if err != nil {
		return nil, err
	}
	if u.Status != domain.StatusInspecting && u.Status != domain.StatusReceived {
		return nil, domain.ErrInvalidTransition
	}

	if err := s.saveIntakeTestPhotos(ctx, unitID, photos, createdBy); err != nil {
		return nil, err
	}
	if u.Status == domain.StatusReceived {
		u, err = s.TransitionUnit(ctx, unitID, domain.StatusInspecting, createdBy, nil)
		if err != nil {
			return nil, err
		}
	}
	if _, err := s.TransitionUnit(ctx, unitID, domain.StatusBlocked, createdBy, nil); err != nil {
		return nil, err
	}

	req := domain.SupplierReturnRequest{
		InventoryUnitID: unitID,
		SKUID:           u.SKUID,
		UnitCode:        u.UnitCode,
		Reason:          reason,
		Status:          "open",
	}
	if u.PurchaseID == nil {
		return nil, domain.NewRuleViolation("NO_SUPPLIER", "unidade sem PO vinculada")
	}
	req.PurchaseOrderID = u.PurchaseID
	supplierID, _, err := s.repo.GetPurchaseOrderSupplier(ctx, *u.PurchaseID)
	if err != nil {
		return nil, err
	}
	req.SupplierID = supplierID
	if err := s.repo.InsertSupplierReturn(ctx, &req, createdBy); err != nil {
		return nil, err
	}
	return &req, nil
}

func (s *Service) ListSupplierReturns(ctx context.Context, status string, limit int) ([]domain.SupplierReturnRequest, error) {
	return s.repo.ListSupplierReturns(ctx, status, limit)
}

var supplierReturnTransitions = map[string][]string{
	"open":       {"sent", "cancelled"},
	"sent":       {"closed"},
	"closed":     {},
	"cancelled":  {},
}

func supplierReturnTransitionAllowed(from, to string) bool {
	allowed, ok := supplierReturnTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func (s *Service) UpdateSupplierReturnStatus(ctx context.Context, id uuid.UUID, newStatus string, _ uuid.UUID) (*domain.SupplierReturnRequest, error) {
	newStatus = strings.TrimSpace(strings.ToLower(newStatus))
	if newStatus == "" {
		return nil, domain.ErrInvalidInput
	}
	req, err := s.repo.GetSupplierReturnByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !supplierReturnTransitionAllowed(req.Status, newStatus) {
		return nil, domain.ErrInvalidTransition
	}
	if err := s.repo.UpdateSupplierReturnStatus(ctx, id, newStatus); err != nil {
		return nil, err
	}
	return s.repo.GetSupplierReturnByID(ctx, id)
}

func (s *Service) GetIntakeTestPhotoFile(ctx context.Context, unitID, photoID uuid.UUID) ([]byte, string, error) {
	filePath, err := s.repo.GetIntakeTestPhoto(ctx, unitID, photoID)
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
