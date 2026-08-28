package service

import (
	"context"
	"strings"

	"github.com/datacenterla/platform/internal/platform/storage"
	"github.com/datacenterla/platform/internal/sales/domain"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
	"time"
)

const defaultRMALocation = "22222222-2222-2222-2222-222222222001"

func expandRMAItems(items []domain.CreateRMAItemInput) []domain.CreateRMAItemInput {
	var out []domain.CreateRMAItemInput
	for _, item := range items {
		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}
		for i := 0; i < qty; i++ {
			copy := item
			copy.Quantity = 1
			out = append(out, copy)
		}
	}
	return out
}

func (s *Service) CreateRMA(ctx context.Context, in domain.CreateRMAInput) (*domain.RMACase, error) {
	if in.OrderID == uuid.Nil || strings.TrimSpace(in.Reason) == "" || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	if strings.TrimSpace(in.TestNotes) == "" {
		return nil, domain.ErrInvalidInput
	}
	if len(in.TestPhotos) == 0 {
		return nil, domain.ErrInvalidInput
	}
	order, err := s.repo.GetOrder(ctx, in.OrderID)
	if err != nil {
		return nil, err
	}
	if order.Status != "shipped" {
		return nil, domain.ErrInvalidState
	}
	skuInOrder := make(map[uuid.UUID]uuid.UUID, len(order.Items))
	for _, line := range order.Items {
		skuInOrder[line.SKUID] = line.ID
	}
	in.Items = expandRMAItems(in.Items)
	for i := range in.Items {
		item := &in.Items[i]
		if item.SKUID == uuid.Nil {
			return nil, domain.ErrInvalidInput
		}
		orderItemID, ok := skuInOrder[item.SKUID]
		if !ok {
			return nil, domain.ErrInvalidInput
		}
		if item.OrderItemID == nil {
			item.OrderItemID = &orderItemID
		}
		if item.InventoryUnitID == nil && item.OrderItemID != nil {
			units, err := s.stock.ListSoldUnitsByOrderItem(ctx, in.OrderID, *item.OrderItemID, 1)
			if err != nil {
				return nil, err
			}
			if len(units) == 0 {
				return nil, domain.ErrNoEligibleUnits
			}
			item.InventoryUnitID = &units[0].ID
		}
	}

	c, err := s.repo.CreateRMACase(ctx, in)
	if err != nil {
		return nil, err
	}
	for _, photo := range in.TestPhotos {
		if len(photo.Body) == 0 {
			continue
		}
		photoID := uuid.New()
		path, err := storage.SaveRMATestPhoto(c.ID, photoID, photo.Ext, photo.Body)
		if err != nil {
			return nil, err
		}
		if _, err := s.repo.AddRMATestPhoto(ctx, c.ID, path, in.RequestedBy); err != nil {
			return nil, err
		}
	}
	return s.repo.GetRMACase(ctx, c.ID)
}

func (s *Service) GetRMA(ctx context.Context, id uuid.UUID) (*domain.RMACase, error) {
	return s.repo.GetRMACase(ctx, id)
}

func (s *Service) ListRMAs(ctx context.Context, status, query string, limit int) ([]domain.RMACase, error) {
	return s.repo.ListRMACases(ctx, status, query, limit)
}

func (s *Service) GetRMATestPhotoFile(ctx context.Context, caseID, photoID uuid.UUID) ([]byte, string, error) {
	_, path, err := s.repo.GetRMATestPhoto(ctx, caseID, photoID)
	if err != nil {
		return nil, "", err
	}
	body, err := storage.ReadDataFile(path)
	if err != nil {
		return nil, "", domain.ErrNotFound
	}
	ext := strings.ToLower(path[strings.LastIndex(path, ".")+1:])
	ct := "image/jpeg"
	switch ext {
	case "png":
		ct = "image/png"
	case "webp":
		ct = "image/webp"
	}
	return body, ct, nil
}

func (s *Service) ApproveRMA(ctx context.Context, id, approvedBy uuid.UUID) (*domain.RMACase, error) {
	c, err := s.repo.GetRMACase(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.Status != "inspecting" && c.Status != "requested" {
		return nil, domain.ErrInvalidState
	}
	if c.TestSubmittedAt == nil || len(c.TestPhotos) == 0 {
		return nil, domain.ErrInvalidInput
	}
	if strings.TrimSpace(c.Reason) == "" || c.TestNotes == nil || strings.TrimSpace(*c.TestNotes) == "" {
		return nil, domain.ErrInvalidInput
	}
	if !c.WithinWarranty {
		return nil, domain.ErrWarrantyExpired
	}
	if err := s.repo.UpdateRMAStatus(ctx, id, "approved", &approvedBy, nil); err != nil {
		return nil, err
	}
	return s.repo.GetRMACase(ctx, id)
}

func (s *Service) ReceiveRMA(ctx context.Context, id, receivedBy uuid.UUID) (*domain.RMACase, error) {
	c, err := s.repo.GetRMACase(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.Status != "approved" {
		return nil, domain.ErrInvalidState
	}
	for _, item := range c.Items {
		if item.InventoryUnitID == nil {
			continue
		}
		if _, err := s.stock.MarkUnitReturned(ctx, *item.InventoryUnitID, receivedBy, stockservice.ReturnRef{
			Type:   "rma",
			ID:     id,
			Reason: "RMA recebido — unidade devolvida",
		}); err != nil {
			return nil, err
		}
	}
	if err := s.repo.UpdateRMAStatus(ctx, id, "received", nil, nil); err != nil {
		return nil, err
	}
	return s.repo.GetRMACase(ctx, id)
}

func (s *Service) ResolveRMA(ctx context.Context, id uuid.UUID, resolution string, resolvedBy uuid.UUID) (*domain.RMACase, error) {
	if resolution == "" {
		resolution = "restock"
	}
	if resolution == "reject" {
		resolution = "scrap"
	}
	c, err := s.repo.GetRMACase(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.Status != "received" {
		return nil, domain.ErrInvalidState
	}
	if c.DefectConfirmed && resolution != "scrap" && resolution != "warranty" && resolution != "refund" {
		return nil, domain.ErrInvalidInput
	}

	locationID := uuid.MustParse(defaultRMALocation)
	for _, item := range c.Items {
		if item.InventoryUnitID == nil {
			continue
		}
		unitID := *item.InventoryUnitID
		switch resolution {
		case "restock", "replace":
			if c.DefectConfirmed {
				return nil, domain.ErrInvalidInput
			}
			if _, err := s.stock.RestockReturnedUnit(ctx, unitID, locationID, resolvedBy, stockservice.ReturnRef{
				Type:   "rma",
				ID:     id,
				Reason: "RMA — reintegração ao estoque",
			}); err != nil {
				return nil, err
			}
		case "scrap":
			if _, err := s.stock.ScrapReturnedUnit(ctx, unitID, resolvedBy, stockservice.ReturnRef{
				Type:   "rma",
				ID:     id,
				Reason: "RMA descarte — peça com defeito confirmado",
			}); err != nil {
				return nil, err
			}
		case "warranty":
			if _, err := s.stock.TransitionUnit(ctx, unitID, stockdomain.StatusWarranty, resolvedBy, nil); err != nil {
				return nil, err
			}
		case "refund":
			// estoque permanece devolvido até tratamento manual
		default:
			return nil, domain.ErrInvalidInput
		}
	}

	if resolution == "refund" {
		order, err := s.repo.GetOrder(ctx, c.OrderID)
		if err != nil {
			return nil, err
		}
		refundTotal := 0.0
		for _, item := range c.Items {
			for _, line := range order.Items {
				if item.OrderItemID != nil && line.ID == *item.OrderItemID {
					refundTotal += line.UnitPriceUSD * float64(item.Quantity)
				}
			}
		}
		if refundTotal <= 0 {
			refundTotal = order.TotalUSD
		}
		if err := s.RecordRefund(ctx, c.OrderID, refundTotal, resolvedBy); err != nil {
			return nil, err
		}
	}

	if err := s.repo.UpdateRMAStatus(ctx, id, "resolved", &resolvedBy, &resolution); err != nil {
		return nil, err
	}
	return s.repo.GetRMACase(ctx, id)
}

func (s *Service) CountSoldUnitsForOrderItem(ctx context.Context, orderID, orderItemID uuid.UUID) (int, error) {
	units, err := s.stock.ListSoldUnitsByOrderItem(ctx, orderID, orderItemID, 100)
	if err != nil {
		return 0, err
	}
	return len(units), nil
}

func (s *Service) GetRMAWarrantyDays(ctx context.Context) (int, error) {
	return s.repo.GetRMAWarrantyDays(ctx)
}

func (s *Service) CheckOrderWarranty(ctx context.Context, orderID uuid.UUID) (int, *time.Time, bool, error) {
	days, err := s.repo.GetRMAWarrantyDays(ctx)
	if err != nil {
		return 0, nil, false, err
	}
	shippedAt, err := s.repo.GetOrderShippedAt(ctx, orderID)
	if err != nil {
		return 0, nil, false, err
	}
	if shippedAt == nil || shippedAt.IsZero() {
		return days, nil, false, nil
	}
	expires := shippedAt.AddDate(0, 0, days)
	return days, &expires, !time.Now().UTC().After(expires), nil
}
