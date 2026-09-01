package service

import (
	"context"

	"github.com/datacenterla/platform/internal/purchases/domain"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type POReceiveIntakeResult struct {
	Order *domain.PurchaseOrder        `json:"order"`
	Units []stockdomain.InventoryUnit  `json:"units"`
}

func (s *Service) ReceivePurchaseOrderWithIntake(
	ctx context.Context,
	poID uuid.UUID,
	in domain.ReceivePOInput,
	batchPhotos []stockdomain.IntakePhotoUpload,
	receivedBy uuid.UUID,
) (*POReceiveIntakeResult, error) {
	po, err := s.repo.GetPOForReceive(ctx, poID)
	if err != nil {
		return nil, err
	}
	if len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	pendingBySKU := map[uuid.UUID]int{}
	for _, item := range po.Items {
		pending := item.QuantityOrdered - item.QuantityReceived
		if pending > 0 {
			pendingBySKU[item.SKUID] = pending
		}
	}

	var intakeItems []stockservice.ReceiveIntakeItemInput
	for _, line := range in.Items {
		if line.SKUID == uuid.Nil || line.Quantity <= 0 {
			return nil, domain.ErrInvalidInput
		}
		pending, ok := pendingBySKU[line.SKUID]
		if !ok || line.Quantity > pending {
			return nil, domain.ErrInvalidInput
		}
		cost, err := s.repo.POItemCost(ctx, poID, line.SKUID)
		if err != nil {
			return nil, domain.ErrInvalidInput
		}
		landed := itemLandedUnitCost(po, line.SKUID, cost)
		intakeItems = append(intakeItems, stockservice.ReceiveIntakeItemInput{
			SKUID:       line.SKUID,
			Quantity:    line.Quantity,
			UnitCostUSD: &landed,
			PurchaseID:  &poID,
		})
	}

	var units []stockdomain.InventoryUnit
	err = s.stock.RunInTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		var receiveErr error
		units, receiveErr = s.stock.ReceiveWithIntakeTx(ctx, tx, stockservice.ReceiveIntakeInput{
			WarehouseID: po.WarehouseID,
			PurchaseID:  &poID,
			Items:       intakeItems,
			BatchPhotos: batchPhotos,
			CreatedBy:   receivedBy,
		})
		if receiveErr != nil {
			return receiveErr
		}
		for _, line := range in.Items {
			if err := s.repo.IncrementReceivedTx(ctx, tx, poID, line.SKUID, line.Quantity); err != nil {
				return err
			}
		}
		return s.repo.RefreshPOStatusTx(ctx, tx, poID)
	})
	if err != nil {
		return nil, err
	}
	updated, err := s.repo.GetPurchaseOrder(ctx, poID)
	if err != nil {
		return nil, err
	}
	if updated.Status == "received" {
		itemsTotal := 0.0
		for _, item := range updated.Items {
			itemsTotal += float64(item.QuantityOrdered) * item.UnitCostUSD
		}
		total := itemsTotal + updated.FreightUSD + updated.DutiesUSD
		_ = s.repo.CreatePayableForPO(ctx, poID, updated.SupplierID, total, updated.ImportOrigin)
	}
	return &POReceiveIntakeResult{Order: updated, Units: units}, nil
}
