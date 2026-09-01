package service

import (
	"context"
	"strings"

	"github.com/datacenterla/platform/internal/purchases/domain"
	"github.com/datacenterla/platform/internal/purchases/repository"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Service struct {
	repo  *repository.Postgres
	stock *stockservice.Service
}

func New(repo *repository.Postgres, stock *stockservice.Service) *Service {
	return &Service{repo: repo, stock: stock}
}

func (s *Service) ListSuppliers(ctx context.Context, limit int) ([]domain.Supplier, error) {
	return s.repo.ListSuppliers(ctx, limit)
}

func (s *Service) CreateSupplier(ctx context.Context, in domain.CreateSupplierInput) (*domain.Supplier, error) {
	in.Code = strings.TrimSpace(in.Code)
	in.Name = strings.TrimSpace(in.Name)
	if in.Code == "" || in.Name == "" {
		return nil, domain.ErrInvalidInput
	}
	if in.Kind == "" {
		in.Kind = "external"
	}
	if in.Kind != "external" && in.Kind != "intercompany" {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.CreateSupplier(ctx, in)
}

func (s *Service) GetSupplier(ctx context.Context, id uuid.UUID) (*domain.Supplier, error) {
	return s.repo.GetSupplier(ctx, id)
}

func (s *Service) UpdateSupplier(ctx context.Context, id uuid.UUID, in domain.UpdateSupplierInput) (*domain.Supplier, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return nil, domain.ErrInvalidInput
	}
	if in.Kind == "" {
		in.Kind = "external"
	}
	if in.Kind != "external" && in.Kind != "intercompany" {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.UpdateSupplier(ctx, id, in)
}

func (s *Service) ListPurchaseOrders(ctx context.Context, status string, limit int) ([]domain.PurchaseOrder, error) {
	return s.repo.ListPurchaseOrders(ctx, status, limit)
}

func (s *Service) GetPurchaseOrder(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error) {
	return s.repo.GetPurchaseOrder(ctx, id)
}

func (s *Service) CreatePurchaseOrder(ctx context.Context, in domain.CreatePOInput, createdBy uuid.UUID) (*domain.PurchaseOrder, error) {
	if in.SupplierID == uuid.Nil || in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	in.ImportOrigin = normalizeImportOrigin(in.ImportOrigin)
	if err := validateOriginCountry(in.ImportOrigin, in.OriginCountryCode); err != nil {
		return nil, err
	}
	if _, err := s.repo.GetSupplier(ctx, in.SupplierID); err != nil {
		return nil, err
	}
	return s.repo.CreatePurchaseOrder(ctx, in, createdBy)
}

func (s *Service) SubmitPurchaseOrder(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error) {
	if err := s.repo.SubmitPurchaseOrder(ctx, id); err != nil {
		return nil, err
	}
	return s.repo.GetPurchaseOrder(ctx, id)
}

func (s *Service) CancelPurchaseOrder(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error) {
	if err := s.repo.CancelPurchaseOrder(ctx, id); err != nil {
		return nil, err
	}
	return s.repo.GetPurchaseOrder(ctx, id)
}

func (s *Service) ReceivePurchaseOrder(ctx context.Context, id uuid.UUID, in domain.ReceivePOInput, receivedBy uuid.UUID) (*domain.PurchaseOrder, error) {
	po, err := s.repo.GetPOForReceive(ctx, id)
	if err != nil {
		return nil, err
	}
	if len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	poID := po.ID
	err = s.stock.RunInTransaction(ctx, func(ctx context.Context, tx pgx.Tx) error {
		for _, line := range in.Items {
			if line.SKUID == uuid.Nil || line.Quantity <= 0 {
				return domain.ErrInvalidInput
			}
			cost, err := s.repo.POItemCost(ctx, id, line.SKUID)
			if err != nil {
				return domain.ErrInvalidInput
			}
			landed := itemLandedUnitCost(po, line.SKUID, cost)
			costPtr := landed
			items := []stockdomain.ReceiveItemInput{{
				SKUID:       line.SKUID,
				Quantity:    line.Quantity,
				UnitCostUSD: &costPtr,
				PurchaseID:  &poID,
			}}
			if _, err := s.stock.ReceiveWithTx(ctx, tx, stockservice.ReceiveInput{
				WarehouseID: po.WarehouseID,
				PurchaseID:  &poID,
				Items:       items,
				CreatedBy:   receivedBy,
			}); err != nil {
				return err
			}
			if err := s.repo.IncrementReceivedTx(ctx, tx, id, line.SKUID, line.Quantity); err != nil {
				return err
			}
		}
		return s.repo.RefreshPOStatusTx(ctx, tx, id)
	})
	if err != nil {
		return nil, err
	}
	updated, err := s.repo.GetPurchaseOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	if updated.Status == "received" {
		itemsTotal := 0.0
		for _, item := range updated.Items {
			itemsTotal += float64(item.QuantityOrdered) * item.UnitCostUSD
		}
		total := itemsTotal + updated.FreightUSD + updated.DutiesUSD
		_ = s.repo.CreatePayableForPO(ctx, id, updated.SupplierID, total, updated.ImportOrigin)
	}
	return updated, nil
}
