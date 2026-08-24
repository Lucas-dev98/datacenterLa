package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
)

func (s *Service) CreateStockCount(ctx context.Context, in domain.CreateCountInput) (*domain.StockCount, error) {
	if in.WarehouseID == uuid.Nil {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.CreateStockCount(ctx, in)
}

func (s *Service) GetStockCount(ctx context.Context, id uuid.UUID) (*domain.StockCount, error) {
	return s.repo.GetStockCount(ctx, id)
}

func (s *Service) ListStockCounts(ctx context.Context, limit int) ([]domain.StockCount, error) {
	return s.repo.ListStockCounts(ctx, limit)
}

func (s *Service) StartStockCount(ctx context.Context, id uuid.UUID) error {
	return s.repo.StartStockCount(ctx, id)
}

func (s *Service) AddCountLine(ctx context.Context, countID uuid.UUID, in domain.CountLineInput) error {
	if in.CountedQty < 0 {
		return domain.ErrInvalidInput
	}
	if in.UnitCode != nil && strings.TrimSpace(*in.UnitCode) != "" {
		unit, err := s.repo.GetUnitByCode(ctx, *in.UnitCode)
		if err != nil {
			return err
		}
		return s.repo.UpsertCountLineByUnit(ctx, countID, unit)
	}
	if in.SKUID != nil && *in.SKUID != uuid.Nil {
		return s.repo.UpsertCountLineBySKU(ctx, countID, *in.SKUID, in.CountedQty)
	}
	return domain.ErrInvalidInput
}

func (s *Service) CompleteStockCount(ctx context.Context, id uuid.UUID) error {
	return s.repo.CompleteStockCount(ctx, id)
}

func (s *Service) ApproveStockCount(ctx context.Context, countID, approvedBy uuid.UUID) (*domain.StockCount, error) {
	count, err := s.repo.GetStockCount(ctx, countID)
	if err != nil {
		return nil, err
	}
	lines, err := s.repo.ApproveStockCount(ctx, countID, approvedBy)
	if err != nil {
		return nil, err
	}
	for _, line := range lines {
		if line.Variance == 0 || line.SKUID == nil {
			continue
		}
		reason := fmt.Sprintf("Inventário %s — variância %d", countID, line.Variance)
		if err := s.repo.CreateAdjustmentFromCount(ctx, countID, count.WarehouseID, *line.SKUID, approvedBy, line.Variance, reason); err != nil {
			return nil, err
		}
	}
	return s.repo.GetStockCount(ctx, countID)
}

func (s *Service) CreateAdjustment(ctx context.Context, in domain.CreateAdjustmentInput) (*domain.StockAdjustment, error) {
	if in.WarehouseID == uuid.Nil || in.SKUID == uuid.Nil || in.QuantityDelta == 0 {
		return nil, domain.ErrInvalidInput
	}
	if strings.TrimSpace(in.Reason) == "" {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.CreateAdjustment(ctx, in)
}

func (s *Service) ListAdjustments(ctx context.Context, status string, limit int) ([]domain.StockAdjustment, error) {
	return s.repo.ListAdjustments(ctx, status, limit)
}

func (s *Service) ApproveAdjustment(ctx context.Context, id, approvedBy uuid.UUID) error {
	return s.repo.ApproveAdjustment(ctx, id, approvedBy)
}

func (s *Service) ApplyAdjustment(ctx context.Context, id, appliedBy uuid.UUID) error {
	adj, err := s.repo.GetAdjustment(ctx, id)
	if err != nil {
		return err
	}
	if adj.Status != "approved" {
		return domain.ErrInvalidInput
	}
	if adj.SKUID == nil {
		return domain.ErrInvalidInput
	}
	skuID := *adj.SKUID
	delta := adj.QuantityDelta

	if delta > 0 {
		units, err := s.Receive(ctx, ReceiveInput{
			WarehouseID: adj.WarehouseID,
			Items:       []domain.ReceiveItemInput{{SKUID: skuID, Quantity: delta}},
			CreatedBy:   appliedBy,
		})
		if err != nil {
			return err
		}
		locID, err := s.repo.GetFirstLocationID(ctx, adj.WarehouseID)
		if err != nil {
			return err
		}
		for _, u := range units {
			for _, st := range []domain.UnitStatus{domain.StatusInspecting, domain.StatusIdentified} {
				if _, err := s.TransitionUnit(ctx, u.ID, st, appliedBy, nil); err != nil {
					return err
				}
			}
			if _, err := s.ReleaseUnit(ctx, u.ID, *locID, appliedBy); err != nil {
				return err
			}
		}
	} else if delta < 0 {
		units, err := s.repo.ListAvailableUnitsForSKU(ctx, skuID, adj.WarehouseID, -delta)
		if err != nil {
			return err
		}
		if len(units) < -delta {
			return domain.ErrInsufficientStock
		}
		for i := 0; i < -delta; i++ {
			if _, err := s.TransitionUnit(ctx, units[i].ID, domain.StatusWrittenOff, appliedBy, nil); err != nil {
				return err
			}
		}
	}
	return s.repo.MarkAdjustmentApplied(ctx, id)
}
