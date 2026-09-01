package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/datacenterla/platform/internal/stock/repository"
	"github.com/datacenterla/platform/internal/stock/rules"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Service struct {
	repo *repository.Postgres
}

func New(repo *repository.Postgres) *Service {
	return &Service{repo: repo}
}

type ReceiveInput struct {
	WarehouseID uuid.UUID
	PurchaseID  *uuid.UUID
	Items       []domain.ReceiveItemInput
	CreatedBy   uuid.UUID
}

func (s *Service) Receive(ctx context.Context, in ReceiveInput) ([]domain.InventoryUnit, error) {
	if in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	var created []domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		return s.receiveItemsInTx(ctx, tx, in, &created)
	})
	return created, err
}

func (s *Service) TransitionUnit(ctx context.Context, unitID uuid.UUID, to domain.UnitStatus, createdBy uuid.UUID, locationID *uuid.UUID) (*domain.InventoryUnit, error) {
	var result *domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		unit, err := s.getUnitForUpdate(ctx, tx, unitID)
		if err != nil {
			return err
		}
		updated, err := s.transitionUnit(ctx, tx, unit, to, createdBy, locationID, nil, nil, nil)
		if err != nil {
			return err
		}
		result = updated
		return nil
	})
	return result, err
}

func (s *Service) ReleaseUnit(ctx context.Context, unitID uuid.UUID, locationID uuid.UUID, createdBy uuid.UUID) (*domain.InventoryUnit, error) {
	var result *domain.InventoryUnit
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		unit, err := s.getUnitForUpdate(ctx, tx, unitID)
		if err != nil {
			return err
		}
		if unit.Status != domain.StatusIdentified {
			return domain.NewRuleViolation("INVALID_STATE", "unit must be identified before release")
		}
		now := time.Now().UTC()
		to := domain.StatusAvailable
		patch := repository.UnitPatchFrom(to, &locationID, &now, nil, nil, nil, nil)
		updated, err := s.repo.UpdateUnitStatus(ctx, tx, unit.ID, unit.Version, patch)
		if err != nil {
			return err
		}
		if err := s.recordStatusChange(ctx, tx, unit, to, createdBy, nil, nil); err != nil {
			return err
		}
		if err := s.repo.UpdateBalancePhysical(ctx, tx, unit.SKUID, unit.WarehouseID, 1); err != nil {
			return err
		}
		if err := s.repo.InsertOutbox(ctx, tx, "stock.unit.available", map[string]any{
			"unit_id": updated.ID, "sku_id": updated.SKUID, "warehouse_id": updated.WarehouseID,
		}); err != nil {
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

type ReserveInput struct {
	OrderID   uuid.UUID
	Items     []domain.ReserveItemInput
	ExpiresAt time.Time
	CreatedBy uuid.UUID
}

func (s *Service) CreateReservation(ctx context.Context, in ReserveInput) ([]domain.StockReservation, error) {
	if in.OrderID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	if in.ExpiresAt.IsZero() {
		in.ExpiresAt = time.Now().UTC().Add(48 * time.Hour)
	}

	var reservations []domain.StockReservation
	err := s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		for _, item := range in.Items {
			if item.Quantity <= 0 {
				return domain.ErrInvalidInput
			}
			if err := s.repo.EnsureBalanceRow(ctx, tx, item.SKUID, item.WarehouseID); err != nil {
				return err
			}
			balance, err := s.repo.LockBalance(ctx, tx, item.SKUID, item.WarehouseID)
			if err != nil {
				return err
			}
			available := balance.QtyPhysical - balance.QtyReserved
			if available < item.Quantity {
				return fmt.Errorf("%w: sku %s available %d requested %d",
					domain.ErrInsufficientStock, item.SKUID, available, item.Quantity)
			}

			units, err := s.repo.ListAvailableUnits(ctx, tx, item.SKUID, item.WarehouseID, item.Quantity)
			if err != nil {
				return err
			}
			if len(units) < item.Quantity {
				return domain.ErrInsufficientStock
			}

			for _, unit := range units {
				res := domain.StockReservation{
					OrderID:     in.OrderID,
					OrderItemID: item.OrderItemID,
					SKUID:       item.SKUID,
					WarehouseID: item.WarehouseID,
					Quantity:    1,
					ExpiresAt:   in.ExpiresAt,
				}
				unitID := unit.ID
				res.InventoryUnitID = &unitID
				if err := s.repo.InsertReservation(ctx, tx, &res); err != nil {
					return err
				}

				orderID := in.OrderID
				orderItemID := item.OrderItemID
				resID := res.ID
				updated, err := s.transitionUnit(ctx, tx, &unit, domain.StatusReserved, in.CreatedBy,
					nil, &orderID, &orderItemID, &resID)
				if err != nil {
					return err
				}
				refType := "order"
				refID := in.OrderID
				reason := "order reservation"
				mov := domain.StockMovement{
					MovementType:    domain.MovementReserve,
					SKUID:           updated.SKUID,
					WarehouseID:     updated.WarehouseID,
					InventoryUnitID: &updated.ID,
					Quantity:        1,
					StatusBefore:    ptr(domain.StatusAvailable),
					StatusAfter:     ptr(domain.StatusReserved),
					ReferenceType:   &refType,
					ReferenceID:     &refID,
					Reason:          &reason,
					CreatedBy:       in.CreatedBy,
				}
				if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
					return err
				}
				if err := s.repo.UpdateBalanceReserved(ctx, tx, item.SKUID, item.WarehouseID, 1); err != nil {
					return err
				}
				reservations = append(reservations, res)
			}
		}
		if len(reservations) > 0 {
			first := reservations[0]
			if err := s.repo.InsertOutbox(ctx, tx, "stock.reserved", map[string]any{
				"order_id": in.OrderID,
				"count":    len(reservations),
				"sku_id":   first.SKUID,
			}); err != nil {
				return err
			}
			if err := s.emitAvailableChanged(ctx, tx, first.SKUID, first.WarehouseID); err != nil {
				return err
			}
		}
		return nil
	})
	return reservations, err
}

func (s *Service) ReleaseReservationByOrder(ctx context.Context, orderID uuid.UUID, createdBy uuid.UUID, reason string) error {
	return s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		reservations, err := s.repo.ListActiveReservationsByOrder(ctx, tx, orderID)
		if err != nil {
			return err
		}
		for _, res := range reservations {
			if res.InventoryUnitID == nil {
				continue
			}
			unit, err := s.getUnitForUpdate(ctx, tx, *res.InventoryUnitID)
			if err != nil {
				return err
			}
			if unit.Status == domain.StatusReserved {
				if _, err := s.transitionUnit(ctx, tx, unit, domain.StatusAvailable, createdBy, nil, nil, nil, nil); err != nil {
					return err
				}
				refType := "order"
				refID := orderID
				mov := domain.StockMovement{
					MovementType:    domain.MovementRelease,
					SKUID:           unit.SKUID,
					WarehouseID:     unit.WarehouseID,
					InventoryUnitID: &unit.ID,
					Quantity:        1,
					StatusBefore:    ptr(domain.StatusReserved),
					StatusAfter:     ptr(domain.StatusAvailable),
					ReferenceType:   &refType,
					ReferenceID:     &refID,
					Reason:          &reason,
					CreatedBy:       createdBy,
				}
				if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
					return err
				}
				if err := s.repo.UpdateBalanceReserved(ctx, tx, unit.SKUID, unit.WarehouseID, -1); err != nil {
					return err
				}
			}
			if err := s.repo.UpdateReservationStatus(ctx, tx, res.ID, domain.ReservationReleased); err != nil {
				return err
			}
			if err := s.emitAvailableChanged(ctx, tx, res.SKUID, res.WarehouseID); err != nil {
				return err
			}
		}
		return s.repo.InsertOutbox(ctx, tx, "stock.reservation_released", map[string]any{
			"order_id": orderID, "reason": reason,
		})
	})
}

func (s *Service) StartPick(ctx context.Context, orderID uuid.UUID, createdBy uuid.UUID) error {
	return s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		reservations, err := s.repo.ListActiveReservationsByOrder(ctx, tx, orderID)
		if err != nil {
			return err
		}
		for _, res := range reservations {
			if res.InventoryUnitID == nil {
				continue
			}
			unit, err := s.getUnitForUpdate(ctx, tx, *res.InventoryUnitID)
			if err != nil {
				return err
			}
			if unit.Status != domain.StatusReserved {
				continue
			}
			if _, err := s.transitionUnit(ctx, tx, unit, domain.StatusPicking, createdBy, nil, nil, nil, nil); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Service) Ship(ctx context.Context, orderID uuid.UUID, createdBy uuid.UUID) error {
	return s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		reservations, err := s.repo.ListActiveReservationsByOrder(ctx, tx, orderID)
		if err != nil {
			return err
		}
		if len(reservations) == 0 {
			return domain.ErrNotFound
		}
		now := time.Now().UTC()
		for _, res := range reservations {
			if res.InventoryUnitID == nil {
				continue
			}
			unit, err := s.getUnitForUpdate(ctx, tx, *res.InventoryUnitID)
			if err != nil {
				return err
			}
			if unit.Status != domain.StatusPicking && unit.Status != domain.StatusReserved {
				return domain.NewRuleViolation("INVALID_STATE",
					fmt.Sprintf("unit %s not ready to ship", unit.UnitCode))
			}
			to := domain.StatusSold
			orderIDCopy := orderID
			orderItemID := res.OrderItemID
			patch := repository.UnitPatchFrom(to, unit.LocationID, unit.AvailableAt, &now, &orderIDCopy, &orderItemID, unit.ReservationID)
			updated, err := s.repo.UpdateUnitStatus(ctx, tx, unit.ID, unit.Version, patch)
			if err != nil {
				return err
			}
			if err := s.recordStatusChange(ctx, tx, unit, to, createdBy, ptr("order"), &orderID); err != nil {
				return err
			}
			refType := "order"
			mov := domain.StockMovement{
				MovementType:    domain.MovementSaleOut,
				SKUID:           updated.SKUID,
				WarehouseID:     updated.WarehouseID,
				InventoryUnitID: &updated.ID,
				Quantity:        -1,
				StatusBefore:    &unit.Status,
				StatusAfter:     &to,
				ReferenceType:   &refType,
				ReferenceID:     &orderID,
				CreatedBy:       createdBy,
			}
			if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
				return err
			}
			if err := s.repo.UpdateBalanceReserved(ctx, tx, updated.SKUID, updated.WarehouseID, -1); err != nil {
				return err
			}
			if err := s.repo.UpdateBalancePhysical(ctx, tx, updated.SKUID, updated.WarehouseID, -1); err != nil {
				return err
			}
			if err := s.repo.UpdateReservationStatus(ctx, tx, res.ID, domain.ReservationFulfilled); err != nil {
				return err
			}
			if err := s.emitAvailableChanged(ctx, tx, updated.SKUID, updated.WarehouseID); err != nil {
				return err
			}
		}
		return s.repo.InsertOutbox(ctx, tx, "stock.shipped", map[string]any{"order_id": orderID})
	})
}

func (s *Service) ExpireReservations(ctx context.Context, createdBy uuid.UUID, limit int) (int, error) {
	if limit <= 0 {
		limit = 100
	}
	reservations, err := s.repo.ListExpiredReservations(ctx, limit)
	if err != nil {
		return 0, err
	}
	expired := 0
	for _, res := range reservations {
		if err := s.releaseSingleReservation(ctx, res, createdBy, domain.ReservationExpired, "reservation expired"); err != nil {
			return expired, err
		}
		expired++
	}
	return expired, nil
}

func (s *Service) releaseSingleReservation(ctx context.Context, res domain.StockReservation, createdBy uuid.UUID, status domain.ReservationStatus, reason string) error {
	return s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		if res.InventoryUnitID != nil {
			unit, err := s.getUnitForUpdate(ctx, tx, *res.InventoryUnitID)
			if err != nil {
				return err
			}
			if unit.Status == domain.StatusReserved {
				if _, err := s.transitionUnit(ctx, tx, unit, domain.StatusAvailable, createdBy, nil, nil, nil, nil); err != nil {
					return err
				}
				refType := "reservation"
				refID := res.ID
				mov := domain.StockMovement{
					MovementType:    domain.MovementRelease,
					SKUID:           unit.SKUID,
					WarehouseID:     unit.WarehouseID,
					InventoryUnitID: &unit.ID,
					Quantity:        1,
					StatusBefore:    ptr(domain.StatusReserved),
					StatusAfter:     ptr(domain.StatusAvailable),
					ReferenceType:   &refType,
					ReferenceID:     &refID,
					Reason:          &reason,
					CreatedBy:       createdBy,
				}
				if err := s.repo.InsertMovement(ctx, tx, &mov); err != nil {
					return err
				}
				if err := s.repo.UpdateBalanceReserved(ctx, tx, unit.SKUID, unit.WarehouseID, -1); err != nil {
					return err
				}
			}
		}
		if err := s.repo.UpdateReservationStatus(ctx, tx, res.ID, status); err != nil {
			return err
		}
		return s.emitAvailableChanged(ctx, tx, res.SKUID, res.WarehouseID)
	})
}

func (s *Service) GetAvailability(ctx context.Context, skuID, warehouseID uuid.UUID) (*domain.Availability, error) {
	b, err := s.repo.GetBalance(ctx, skuID, warehouseID)
	if err != nil {
		return nil, err
	}
	return &domain.Availability{
		SKUID:        b.SKUID,
		WarehouseID:  b.WarehouseID,
		QtyPhysical:  b.QtyPhysical,
		QtyReserved:  b.QtyReserved,
		QtyAvailable: b.QtyAvailable,
	}, nil
}

func (s *Service) ListBalances(ctx context.Context, warehouseID uuid.UUID, query string, limit, offset int) ([]domain.BalanceListItem, int, error) {
	if warehouseID == uuid.Nil {
		return nil, 0, domain.ErrInvalidInput
	}
	return s.repo.ListBalances(ctx, warehouseID, query, limit, offset)
}

func (s *Service) ListLowStockSKUs(ctx context.Context, threshold, limit, offset int, query string) ([]domain.LowStockSKU, int, error) {
	return s.repo.ListLowStockSKUs(ctx, threshold, limit, offset, query)
}

func (s *Service) ListMovements(ctx context.Context, warehouseID uuid.UUID, query, movementType string, limit, offset int) ([]domain.MovementListItem, int, error) {
	if warehouseID == uuid.Nil {
		return nil, 0, domain.ErrInvalidInput
	}
	return s.repo.ListMovements(ctx, repository.ListMovementsParams{
		WarehouseID:  warehouseID,
		Query:        query,
		MovementType: movementType,
		Limit:        limit,
		Offset:       offset,
	})
}

func (s *Service) GetUnitByCode(ctx context.Context, code string) (*domain.InventoryUnit, error) {
	return s.repo.GetUnitByCode(ctx, code)
}

func (s *Service) GetUnitDetailByCode(ctx context.Context, code string) (*domain.UnitDetail, error) {
	return s.repo.GetUnitDetailByCode(ctx, code)
}

func (s *Service) getUnitForUpdate(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*domain.InventoryUnit, error) {
	row := tx.QueryRow(ctx, repository.UnitSelectForUpdate(), id)
	return repository.ScanUnitRow(row)
}

func (s *Service) transitionUnit(
	ctx context.Context, tx pgx.Tx, unit *domain.InventoryUnit, to domain.UnitStatus,
	createdBy uuid.UUID, locationID, orderID, orderItemID, reservationID *uuid.UUID,
) (*domain.InventoryUnit, error) {
	if err := rules.ValidateTransition(unit.Status, to); err != nil {
		return nil, err
	}
	patch := repository.UnitPatchFrom(to, locationID, unit.AvailableAt, unit.SoldAt, orderID, orderItemID, reservationID)
	updated, err := s.repo.UpdateUnitStatus(ctx, tx, unit.ID, unit.Version, patch)
	if err != nil {
		return nil, err
	}
	if err := s.recordStatusChange(ctx, tx, unit, to, createdBy, nil, nil); err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) recordStatusChange(ctx context.Context, tx pgx.Tx, unit *domain.InventoryUnit, to domain.UnitStatus, createdBy uuid.UUID, refType *string, refID *uuid.UUID) error {
	before := unit.Status
	mov := domain.StockMovement{
		MovementType:    domain.MovementStatusChange,
		SKUID:           unit.SKUID,
		WarehouseID:     unit.WarehouseID,
		InventoryUnitID: &unit.ID,
		Quantity:        0,
		StatusBefore:    &before,
		StatusAfter:     &to,
		ReferenceType:   refType,
		ReferenceID:     refID,
		CreatedBy:       createdBy,
	}
	return s.repo.InsertMovement(ctx, tx, &mov)
}

func (s *Service) emitAvailableChanged(ctx context.Context, tx pgx.Tx, skuID, warehouseID uuid.UUID) error {
	balance, err := s.repo.LockBalance(ctx, tx, skuID, warehouseID)
	if err != nil {
		return err
	}
	available := balance.QtyPhysical - balance.QtyReserved
	return s.repo.InsertOutbox(ctx, tx, "stock.available_changed", map[string]any{
		"sku_id": skuID, "warehouse_id": warehouseID, "available": available,
	})
}

func ptr[T any](v T) *T { return &v }

func coalescePurchase(a, b *uuid.UUID) *uuid.UUID {
	if b != nil {
		return b
	}
	return a
}

func normalizeHexSerial(s string) (string, error) {
	normalized := strings.ToUpper(strings.TrimSpace(s))
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	if normalized == "" {
		return "", domain.ErrInvalidInput
	}
	if !regexp.MustCompile(`^[0-9A-F]{4,32}$`).MatchString(normalized) {
		return "", domain.NewRuleViolation("INVALID_SERIAL", "identificador hexadecimal inválido")
	}
	return normalized, nil
}
