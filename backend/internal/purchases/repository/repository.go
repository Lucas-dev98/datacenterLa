package repository

import (
	"context"

	"github.com/datacenterla/platform/internal/purchases/domain"
	"github.com/google/uuid"
)

// Repository abstracts persistence for purchases domain (enables unit tests with mocks).
type Repository interface {
	ListSuppliers(ctx context.Context, limit int) ([]domain.Supplier, error)
	GetSupplier(ctx context.Context, id uuid.UUID) (*domain.Supplier, error)
	CreateSupplier(ctx context.Context, in domain.CreateSupplierInput) (*domain.Supplier, error)
	UpdateSupplier(ctx context.Context, id uuid.UUID, in domain.UpdateSupplierInput) (*domain.Supplier, error)
	ListPurchaseOrders(ctx context.Context, status string, limit int) ([]domain.PurchaseOrder, error)
	GetPurchaseOrder(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error)
	CreatePurchaseOrder(ctx context.Context, in domain.CreatePOInput, createdBy uuid.UUID) (*domain.PurchaseOrder, error)
	SubmitPurchaseOrder(ctx context.Context, id uuid.UUID) error
	CancelPurchaseOrder(ctx context.Context, id uuid.UUID) error
	GetPOForReceive(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error)
	POItemCost(ctx context.Context, poID, skuID uuid.UUID) (float64, error)
	IncrementReceived(ctx context.Context, poID, skuID uuid.UUID, qty int) error
	RefreshPOStatus(ctx context.Context, poID uuid.UUID) error
	CreatePayableForPO(ctx context.Context, poID uuid.UUID, supplierID uuid.UUID, amount float64, importOrigin string) error
}
