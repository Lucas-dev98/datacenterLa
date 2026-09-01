//go:build integration

package service_test

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/datacenterla/platform/internal/db"
	"github.com/datacenterla/platform/internal/pim/domain"
	"github.com/datacenterla/platform/internal/pim/repository"
	"github.com/datacenterla/platform/internal/pim/service"
	"github.com/google/uuid"
)

func TestPIMCadastroSKUFlow(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	svc := service.New(repository.NewPostgres(pool))

	cat, err := svc.CreateCategory(ctx, domain.CreateCategoryInput{
		Code: fmt.Sprintf("SSD-%s", uuid.New().String()[:8]),
		Name: "SSD",
	})
	if err != nil {
		t.Fatalf("category: %v", err)
	}

	prod, err := svc.CreateProduct(ctx, domain.CreateProductInput{
		Name:       "SSD Samsung 960GB",
		CategoryID: &cat.ID,
	})
	if err != nil {
		t.Fatalf("product: %v", err)
	}

	sku, err := svc.CreateSKU(ctx, domain.CreateSKUInput{
		ProductID: prod.ID,
		Name:      "SSD Samsung 960GB Enterprise",
	})
	if err != nil {
		t.Fatalf("sku: %v", err)
	}
	if len(sku.Code) != 6 {
		t.Fatalf("sku code must be 6 digits, got %q", sku.Code)
	}

	got, err := svc.GetSKUByCode(ctx, sku.Code)
	if err != nil {
		t.Fatalf("get sku: %v", err)
	}
	if got.ID != sku.ID {
		t.Fatal("sku mismatch")
	}
}
