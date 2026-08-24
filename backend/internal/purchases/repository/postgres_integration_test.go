//go:build integration

package repository_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/datacenterla/platform/internal/db"
	"github.com/datacenterla/platform/internal/purchases/domain"
	purchrepo "github.com/datacenterla/platform/internal/purchases/repository"
	"github.com/google/uuid"
)

func TestPurchaseOrderFlow(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Skip(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	repo := purchrepo.New(pool)
	supplier, err := repo.CreateSupplier(ctx, domain.CreateSupplierInput{
		Code: fmt.Sprintf("SUP-%d", time.Now().UnixNano()%999999),
		Name: "Fornecedor Teste",
	})
	if err != nil {
		t.Fatal(err)
	}

	skuID := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	warehouseID := uuid.MustParse("11111111-1111-1111-1111-111111111001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	po, err := repo.CreatePurchaseOrder(ctx, domain.CreatePOInput{
		SupplierID:  supplier.ID,
		WarehouseID: warehouseID,
		Items:       []domain.CreatePOItemInput{{SKUID: skuID, Quantity: 2, UnitCostUSD: 10}},
	}, userID)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.SubmitPurchaseOrder(ctx, po.ID); err != nil {
		t.Fatal(err)
	}
	got, err := repo.GetPurchaseOrder(ctx, po.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "ordered" {
		t.Fatalf("expected ordered, got %s", got.Status)
	}
}
