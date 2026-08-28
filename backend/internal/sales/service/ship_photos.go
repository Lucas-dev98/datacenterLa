package service

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/datacenterla/platform/internal/platform/storage"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

func (s *Service) ShipOrderWithPhotos(
	ctx context.Context,
	orderID uuid.UUID,
	photos map[uuid.UUID]domain.ShipPhotoUpload,
	createdBy uuid.UUID,
) (*domain.Order, error) {
	o, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "confirmed" && o.Status != "paid" {
		return nil, domain.ErrInvalidState
	}
	if len(o.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	for _, item := range o.Items {
		upload, ok := photos[item.ID]
		if !ok || len(upload.Body) == 0 {
			return nil, domain.ErrInvalidInput
		}
		path, err := storage.SaveOrderShipPhoto(orderID, item.ID, upload.Ext, upload.Body)
		if err != nil {
			return nil, err
		}
		if _, err := s.repo.AddOrderShipPhoto(ctx, orderID, item.ID, item.SKUID, path, createdBy); err != nil {
			return nil, err
		}
	}

	return s.ShipOrder(ctx, orderID, createdBy)
}

func (s *Service) GetOrderShipPhotoFile(ctx context.Context, orderID, photoID uuid.UUID) ([]byte, string, error) {
	photo, err := s.repo.GetOrderShipPhoto(ctx, orderID, photoID)
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
