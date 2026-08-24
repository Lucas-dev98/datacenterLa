package service

import (
	"context"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
)

func (s *Service) ListIntakeQueue(ctx context.Context, warehouseID *uuid.UUID, limit int) ([]domain.IntakeQueueItem, error) {
	return s.repo.ListIntakeQueue(ctx, warehouseID, limit)
}

func (s *Service) CompleteIntake(ctx context.Context, unitID, locationID, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	u, err := s.repo.GetUnitByID(ctx, unitID)
	if err != nil {
		return nil, err
	}
	switch u.Status {
	case domain.StatusReceived:
		u, err = s.TransitionUnit(ctx, unitID, domain.StatusInspecting, createdBy, nil)
		if err != nil {
			return nil, err
		}
		fallthrough
	case domain.StatusInspecting:
		u, err = s.TransitionUnit(ctx, unitID, domain.StatusIdentified, createdBy, nil)
		if err != nil {
			return nil, err
		}
		fallthrough
	case domain.StatusIdentified:
		return s.ReleaseUnit(ctx, unitID, locationID, createdBy)
	default:
		return nil, domain.ErrInvalidTransition
	}
}

type CompleteIntakeBatchResult struct {
	Completed []domain.InventoryUnit `json:"completed"`
	Failed    []IntakeBatchFailure   `json:"failed,omitempty"`
}

type IntakeBatchFailure struct {
	UnitID uuid.UUID `json:"unit_id"`
	Error  string    `json:"error"`
}

func (s *Service) CompleteIntakeBatch(ctx context.Context, unitIDs []uuid.UUID, locationID, createdBy uuid.UUID) (*CompleteIntakeBatchResult, error) {
	if len(unitIDs) == 0 {
		return nil, domain.ErrInvalidInput
	}
	res := &CompleteIntakeBatchResult{}
	for _, id := range unitIDs {
		u, err := s.CompleteIntake(ctx, id, locationID, createdBy)
		if err != nil {
			res.Failed = append(res.Failed, IntakeBatchFailure{UnitID: id, Error: err.Error()})
			continue
		}
		res.Completed = append(res.Completed, *u)
	}
	if len(res.Completed) == 0 && len(res.Failed) > 0 {
		return res, domain.ErrInvalidInput
	}
	return res, nil
}

func (s *Service) AdvanceIntake(ctx context.Context, unitID uuid.UUID, locationID *uuid.UUID, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	u, err := s.repo.GetUnitByID(ctx, unitID)
	if err != nil {
		return nil, err
	}
	return s.advanceIntakeUnit(ctx, u, locationID, createdBy)
}

func (s *Service) AdvanceIntakeByCode(ctx context.Context, unitCode string, locationID *uuid.UUID, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	u, err := s.repo.GetUnitByCode(ctx, unitCode)
	if err != nil {
		return nil, err
	}
	return s.advanceIntakeUnit(ctx, u, locationID, createdBy)
}

func (s *Service) advanceIntakeUnit(ctx context.Context, u *domain.InventoryUnit, locationID *uuid.UUID, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	switch u.Status {
	case domain.StatusReceived:
		return s.TransitionUnit(ctx, u.ID, domain.StatusInspecting, createdBy, nil)
	case domain.StatusInspecting:
		return s.TransitionUnit(ctx, u.ID, domain.StatusIdentified, createdBy, nil)
	case domain.StatusIdentified:
		if locationID == nil || *locationID == uuid.Nil {
			return nil, domain.ErrInvalidInput
		}
		return s.ReleaseUnit(ctx, u.ID, *locationID, createdBy)
	default:
		return nil, domain.ErrInvalidTransition
	}
}

type AdvanceIntakeBatchResult struct {
	Advanced []domain.InventoryUnit `json:"advanced"`
	Failed   []IntakeBatchFailure   `json:"failed,omitempty"`
}

func (s *Service) AdvanceIntakeBatch(ctx context.Context, unitIDs []uuid.UUID, locationID *uuid.UUID, createdBy uuid.UUID) (*AdvanceIntakeBatchResult, error) {
	if len(unitIDs) == 0 {
		return nil, domain.ErrInvalidInput
	}
	res := &AdvanceIntakeBatchResult{}
	for _, id := range unitIDs {
		u, err := s.AdvanceIntake(ctx, id, locationID, createdBy)
		if err != nil {
			res.Failed = append(res.Failed, IntakeBatchFailure{UnitID: id, Error: err.Error()})
			continue
		}
		res.Advanced = append(res.Advanced, *u)
	}
	if len(res.Advanced) == 0 && len(res.Failed) > 0 {
		return res, domain.ErrInvalidInput
	}
	return res, nil
}
