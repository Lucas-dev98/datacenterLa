package service

import (
	"context"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// RunInTransaction executes fn inside a single database transaction.
func (s *Service) RunInTransaction(ctx context.Context, fn func(ctx context.Context, tx pgx.Tx) error) error {
	return s.repo.WithTx(ctx, func(tx pgx.Tx) error {
		return fn(ctx, tx)
	})
}

// ReceiveWithTx creates inventory units inside an existing transaction.
func (s *Service) ReceiveWithTx(ctx context.Context, tx pgx.Tx, in ReceiveInput) ([]domain.InventoryUnit, error) {
	if in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	var created []domain.InventoryUnit
	if err := s.receiveItemsInTx(ctx, tx, in, &created); err != nil {
		return nil, err
	}
	return created, nil
}

func (s *Service) receiveItemsInTx(ctx context.Context, tx pgx.Tx, in ReceiveInput, created *[]domain.InventoryUnit) error {
	now := time.Now().UTC()
	for _, item := range in.Items {
		if item.SKUID == uuid.Nil || item.Quantity <= 0 {
			return domain.ErrInvalidInput
		}
		for i := 0; i < item.Quantity; i++ {
			var serial *string
			if len(item.Units) > i && strings.TrimSpace(item.Units[i].SerialNumber) != "" {
				normalized, err := normalizeHexSerial(item.Units[i].SerialNumber)
				if err != nil {
					return err
				}
				serial = &normalized
			} else if item.SerialNumber != nil && *item.SerialNumber != "" && item.Quantity == 1 {
				normalized, err := normalizeHexSerial(*item.SerialNumber)
				if err != nil {
					return err
				}
				serial = &normalized
			}
			unit := domain.InventoryUnit{
				SKUID:        item.SKUID,
				WarehouseID:  in.WarehouseID,
				Status:       domain.StatusReceived,
				PurchaseID:   coalescePurchase(in.PurchaseID, item.PurchaseID),
				UnitCostUSD:  item.UnitCostUSD,
				ReceivedAt:   &now,
				SerialNumber: serial,
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
			*created = append(*created, unit)
		}
	}
	return nil
}
