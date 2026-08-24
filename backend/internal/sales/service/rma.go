package service

import (
	"context"
	"strings"

	"github.com/datacenterla/platform/internal/sales/domain"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
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
				return nil, domain.ErrInvalidInput
			}
			item.InventoryUnitID = &units[0].ID
		}
	}
	return s.repo.CreateRMACase(ctx, in)
}

func (s *Service) GetRMA(ctx context.Context, id uuid.UUID) (*domain.RMACase, error) {
	return s.repo.GetRMACase(ctx, id)
}

func (s *Service) ListRMAs(ctx context.Context, status string, limit int) ([]domain.RMACase, error) {
	return s.repo.ListRMACases(ctx, status, limit)
}

func (s *Service) ApproveRMA(ctx context.Context, id, approvedBy uuid.UUID) (*domain.RMACase, error) {
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
		if _, err := s.stock.MarkUnitReturned(ctx, *item.InventoryUnitID, receivedBy, id); err != nil {
			return nil, err
		}
	}
	resolution := "restock"
	if err := s.repo.UpdateRMAStatus(ctx, id, "received", nil, &resolution); err != nil {
		return nil, err
	}
	return s.repo.GetRMACase(ctx, id)
}

func (s *Service) ResolveRMA(ctx context.Context, id uuid.UUID, resolution string, resolvedBy uuid.UUID) (*domain.RMACase, error) {
	if resolution == "" {
		resolution = "restock"
	}
	c, err := s.repo.GetRMACase(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.Status != "received" {
		return nil, domain.ErrInvalidState
	}

	locationID := uuid.MustParse(defaultRMALocation)
	for _, item := range c.Items {
		if item.InventoryUnitID == nil {
			continue
		}
		unitID := *item.InventoryUnitID
		switch resolution {
		case "restock", "replace":
			if _, err := s.stock.RestockReturnedUnit(ctx, unitID, locationID, resolvedBy); err != nil {
				return nil, err
			}
		case "warranty":
			if _, err := s.stock.TransitionUnit(ctx, unitID, stockdomain.StatusWarranty, resolvedBy, nil); err != nil {
				return nil, err
			}
		case "reject":
			if _, err := s.stock.TransitionReturnedToDamaged(ctx, unitID, resolvedBy); err != nil {
				return nil, err
			}
		case "refund":
			// stock stays returned until manual handling; financial refund below
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
