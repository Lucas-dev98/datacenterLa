package service

import (
	"context"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/platform/storage"
	"github.com/datacenterla/platform/internal/sales/domain"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
)

func (s *Service) CreateCustomerReturn(ctx context.Context, in domain.CreateCustomerReturnInput) (*domain.CustomerReturn, error) {
	if in.OrderID == uuid.Nil || strings.TrimSpace(in.Reason) == "" || len(in.Items) == 0 {
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
	in.Items = expandReturnItems(in.Items)
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

	ret, err := s.repo.CreateCustomerReturn(ctx, in)
	if err != nil {
		return nil, err
	}
	for _, photo := range in.Photos {
		if len(photo.Body) == 0 {
			continue
		}
		photoID := uuid.New()
		path, err := storage.SaveCustomerReturnPhoto(ret.ID, photoID, photo.Ext, photo.Body)
		if err != nil {
			return nil, err
		}
		if _, err := s.repo.AddCustomerReturnPhoto(ctx, ret.ID, path, in.RequestedBy); err != nil {
			return nil, err
		}
	}
	return s.repo.GetCustomerReturn(ctx, ret.ID)
}

func expandReturnItems(items []domain.CreateReturnItemInput) []domain.CreateReturnItemInput {
	var out []domain.CreateReturnItemInput
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

func (s *Service) GetCustomerReturn(ctx context.Context, id uuid.UUID) (*domain.CustomerReturn, error) {
	return s.repo.GetCustomerReturn(ctx, id)
}

func (s *Service) ListCustomerReturns(ctx context.Context, status, query string, limit int) ([]domain.CustomerReturn, error) {
	return s.repo.ListCustomerReturns(ctx, status, query, limit)
}

func (s *Service) GetCustomerReturnPhotoFile(ctx context.Context, returnID, photoID uuid.UUID) ([]byte, string, error) {
	_, path, err := s.repo.GetCustomerReturnPhoto(ctx, returnID, photoID)
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

func (s *Service) ApproveCustomerReturn(ctx context.Context, id, approvedBy uuid.UUID) (*domain.CustomerReturn, error) {
	ret, err := s.repo.GetCustomerReturn(ctx, id)
	if err != nil {
		return nil, err
	}
	if ret.Status != "requested" {
		return nil, domain.ErrInvalidState
	}
	if !ret.WithinReturnWindow {
		return nil, domain.ErrReturnWindowExpired
	}
	if err := s.repo.UpdateCustomerReturnStatus(ctx, id, "approved", &approvedBy, nil, nil); err != nil {
		return nil, err
	}
	return s.repo.GetCustomerReturn(ctx, id)
}

func (s *Service) ReceiveCustomerReturn(ctx context.Context, id, receivedBy uuid.UUID) (*domain.CustomerReturn, error) {
	ret, err := s.repo.GetCustomerReturn(ctx, id)
	if err != nil {
		return nil, err
	}
	if ret.Status != "approved" {
		return nil, domain.ErrInvalidState
	}
	ref := stockservice.ReturnRef{
		Type:   "return",
		ID:     id,
		Reason: "Devolução recebida",
	}
	for _, item := range ret.Items {
		if item.InventoryUnitID == nil {
			continue
		}
		if _, err := s.stock.MarkUnitReturned(ctx, *item.InventoryUnitID, receivedBy, ref); err != nil {
			return nil, err
		}
	}
	if err := s.repo.UpdateCustomerReturnStatus(ctx, id, "received", nil, nil, nil); err != nil {
		return nil, err
	}
	return s.repo.GetCustomerReturn(ctx, id)
}

func (s *Service) ResolveCustomerReturn(ctx context.Context, id uuid.UUID, resolution string, resolvedBy uuid.UUID) (*domain.CustomerReturn, error) {
	if resolution == "" {
		resolution = "restock"
	}
	ret, err := s.repo.GetCustomerReturn(ctx, id)
	if err != nil {
		return nil, err
	}
	if ret.Status != "received" {
		return nil, domain.ErrInvalidState
	}

	locationID := uuid.MustParse(defaultRMALocation)
	for _, item := range ret.Items {
		if item.InventoryUnitID == nil {
			continue
		}
		unitID := *item.InventoryUnitID
		switch resolution {
		case "restock":
			if _, err := s.stock.RestockReturnedUnit(ctx, unitID, locationID, resolvedBy, stockservice.ReturnRef{
				Type:   "return",
				ID:     id,
				Reason: "Devolução — reintegração ao estoque",
			}); err != nil {
				return nil, err
			}
		case "reject":
			if _, err := s.stock.ScrapReturnedUnit(ctx, unitID, resolvedBy, stockservice.ReturnRef{
				Type:   "return",
				ID:     id,
				Reason: "Devolução rejeitada — peça avariada ou incompleta",
			}); err != nil {
				return nil, err
			}
		case "refund":
			// unidade permanece devolvida
		default:
			return nil, domain.ErrInvalidInput
		}
	}

	if resolution == "refund" {
		order, err := s.repo.GetOrder(ctx, ret.OrderID)
		if err != nil {
			return nil, err
		}
		refundTotal := 0.0
		for _, item := range ret.Items {
			for _, line := range order.Items {
				if item.OrderItemID != nil && line.ID == *item.OrderItemID {
					refundTotal += line.UnitPriceUSD * float64(item.Quantity)
				}
			}
		}
		if refundTotal <= 0 {
			refundTotal = order.TotalUSD
		}
		if err := s.RecordRefund(ctx, ret.OrderID, refundTotal, resolvedBy); err != nil {
			return nil, err
		}
	}

	if err := s.repo.UpdateCustomerReturnStatus(ctx, id, "resolved", nil, &resolvedBy, &resolution); err != nil {
		return nil, err
	}
	return s.repo.GetCustomerReturn(ctx, id)
}

func (s *Service) GetReturnWindowDays(ctx context.Context) (int, error) {
	return s.repo.GetReturnWindowDays(ctx)
}

func (s *Service) CheckOrderReturnWindow(ctx context.Context, orderID uuid.UUID) (int, *time.Time, bool, error) {
	days, err := s.repo.GetReturnWindowDays(ctx)
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
