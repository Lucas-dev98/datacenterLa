package service

import (
	"context"
	"fmt"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ReturnRef links stock movements to a post-sale case (devolução or RMA).
type ReturnRef struct {
	Type   string
	ID     uuid.UUID
	Reason string
}

func (s *Service) ListSoldUnitsByOrderItem(ctx context.Context, orderID, orderItemID uuid.UUID, limit int) ([]domain.InventoryUnit, error) {
	return s.repo.ListSoldUnitsByOrderItem(ctx, orderID, orderItemID, limit)
}

func (s *Service) RestockReturnedUnit(ctx context.Context, unitID, locationID, createdBy uuid.UUID, ref ReturnRef) (*domain.InventoryUnit, error) {
	if locationID == uuid.Nil {
		return nil, domain.ErrInvalidInput
	}
	if ref.Type == "" {
		ref.Type = "return"
	}
	if ref.Reason == "" {
		ref.Reason = "Devolução — reintegração ao estoque"
	}
	var result *domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		unit, err := s.getUnitForUpdate(ctx, tx, unitID)
		if err != nil {
			return err
		}
		if unit.Status != domain.StatusReturned {
			return domain.NewRuleViolation("INVALID_STATE", fmt.Sprintf("unit %s must be returned", unit.UnitCode))
		}
		before := unit.Status
		updated, err := s.repo.RestockReturnedUnit(ctx, tx, unit.ID, unit.Version, locationID)
		if err != nil {
			return err
		}
		refType := ref.Type
		refID := ref.ID
		reason := ref.Reason
		mov := domain.StockMovement{
			MovementType:    domain.MovementReturnIn,
			SKUID:           updated.SKUID,
			WarehouseID:     updated.WarehouseID,
			InventoryUnitID: &updated.ID,
			Quantity:        1,
			StatusBefore:    &before,
			StatusAfter:     ptr(domain.StatusAvailable),
			ReferenceType:   &refType,
			ReferenceID:     &refID,
			Reason:          &reason,
			CreatedBy:       createdBy,
		}
		if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
			return err
		}
		if err := s.repo.UpdateBalancePhysical(ctx, tx, updated.SKUID, updated.WarehouseID, 1); err != nil {
			return err
		}
		if err := s.recordStatusChange(ctx, tx, unit, domain.StatusAvailable, createdBy, &refType, &refID); err != nil {
			return err
		}
		if err := s.emitAvailableChanged(ctx, tx, updated.SKUID, updated.WarehouseID); err != nil {
			return err
		}
		result = updated
		return nil
	})
	return result, err
}

func (s *Service) MarkUnitReturned(ctx context.Context, unitID, createdBy uuid.UUID, ref ReturnRef) (*domain.InventoryUnit, error) {
	if ref.Type == "" {
		ref.Type = "return"
	}
	if ref.Reason == "" {
		ref.Reason = "Devolução recebida"
	}
	var result *domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		unit, err := s.getUnitForUpdate(ctx, tx, unitID)
		if err != nil {
			return err
		}
		if unit.Status != domain.StatusSold {
			return domain.NewRuleViolation("INVALID_STATE", fmt.Sprintf("unit %s is not sold", unit.UnitCode))
		}
		updated, err := s.transitionUnit(ctx, tx, unit, domain.StatusReturned, createdBy, nil, nil, nil, nil)
		if err != nil {
			return err
		}
		refType := ref.Type
		refID := ref.ID
		reason := ref.Reason
		mov := domain.StockMovement{
			MovementType:    domain.MovementStatusChange,
			SKUID:           updated.SKUID,
			WarehouseID:     updated.WarehouseID,
			InventoryUnitID: &updated.ID,
			Quantity:        0,
			StatusBefore:    ptr(domain.StatusSold),
			StatusAfter:     ptr(domain.StatusReturned),
			ReferenceType:   &refType,
			ReferenceID:     &refID,
			Reason:          &reason,
			CreatedBy:       createdBy,
		}
		if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
			return err
		}
		result = updated
		return nil
	})
	return result, err
}

func (s *Service) TransitionReturnedToDamaged(ctx context.Context, unitID, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	return s.TransitionUnit(ctx, unitID, domain.StatusDamaged, createdBy, nil)
}

func (s *Service) ScrapReturnedUnit(ctx context.Context, unitID, createdBy uuid.UUID, ref ReturnRef) (*domain.InventoryUnit, error) {
	if ref.Type == "" {
		ref.Type = "return"
	}
	if ref.Reason == "" {
		ref.Reason = "Descarte — peça não reintegrável"
	}
	var result *domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		unit, err := s.getUnitForUpdate(ctx, tx, unitID)
		if err != nil {
			return err
		}
		if unit.Status != domain.StatusReturned {
			return domain.NewRuleViolation("INVALID_STATE", fmt.Sprintf("unit %s must be returned", unit.UnitCode))
		}
		before := unit.Status
		updated, err := s.transitionUnit(ctx, tx, unit, domain.StatusWrittenOff, createdBy, nil, nil, nil, nil)
		if err != nil {
			return err
		}
		refType := ref.Type
		refID := ref.ID
		reason := ref.Reason
		mov := domain.StockMovement{
			MovementType:    domain.MovementDamageOut,
			SKUID:           updated.SKUID,
			WarehouseID:     updated.WarehouseID,
			InventoryUnitID: &updated.ID,
			Quantity:        1,
			StatusBefore:    &before,
			StatusAfter:     ptr(domain.StatusWrittenOff),
			ReferenceType:   &refType,
			ReferenceID:     &refID,
			Reason:          &reason,
			CreatedBy:       createdBy,
		}
		if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
			return err
		}
		result = updated
		return nil
	})
	return result, err
}
