//go:build integration

package service_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/datacenterla/platform/internal/db"
	"github.com/datacenterla/platform/internal/purchases/domain"
	purchrepo "github.com/datacenterla/platform/internal/purchases/repository"
	purchservice "github.com/datacenterla/platform/internal/purchases/service"
	stockrepo "github.com/datacenterla/platform/internal/stock/repository"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMain(m *testing.M) {
	if os.Getenv("DATABASE_URL") == "" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestMultiItemPurchaseOrderPartialReceive(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	sku1 := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	sku2 := seedExtraSKU(t, ctx, pool)
	warehouseID := uuid.MustParse("11111111-1111-1111-1111-111111111001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	svc := purchservice.New(purchrepo.New(pool), stockSvc)

	supplier, err := svc.CreateSupplier(ctx, domain.CreateSupplierInput{
		Code: fmt.Sprintf("SUP-%d", time.Now().UnixNano()%999999),
		Name: "Fornecedor Multi",
	})
	if err != nil {
		t.Fatalf("supplier: %v", err)
	}

	po, err := svc.CreatePurchaseOrder(ctx, domain.CreatePOInput{
		SupplierID:  supplier.ID,
		WarehouseID: warehouseID,
		Items: []domain.CreatePOItemInput{
			{SKUID: sku1, Quantity: 5, UnitCostUSD: 10},
			{SKUID: sku2, Quantity: 3, UnitCostUSD: 25.5},
		},
	}, userID)
	if err != nil {
		t.Fatalf("create po: %v", err)
	}
	if len(po.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(po.Items))
	}

	po, err = svc.SubmitPurchaseOrder(ctx, po.ID)
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if po.Status != "ordered" {
		t.Fatalf("expected ordered, got %s", po.Status)
	}

	po, err = svc.ReceivePurchaseOrder(ctx, po.ID, domain.ReceivePOInput{
		Items: []domain.ReceivePOItemInput{
			{SKUID: sku1, Quantity: 2},
			{SKUID: sku2, Quantity: 3},
		},
	}, userID)
	if err != nil {
		t.Fatalf("partial receive: %v", err)
	}
	if po.Status != "partial" {
		t.Fatalf("expected partial, got %s", po.Status)
	}

	for _, item := range po.Items {
		switch item.SKUID {
		case sku1:
			if item.QuantityReceived != 2 {
				t.Fatalf("sku1 received: want 2 got %d", item.QuantityReceived)
			}
		case sku2:
			if item.QuantityReceived != 3 {
				t.Fatalf("sku2 received: want 3 got %d", item.QuantityReceived)
			}
		}
	}

	po, err = svc.ReceivePurchaseOrder(ctx, po.ID, domain.ReceivePOInput{
		Items: []domain.ReceivePOItemInput{{SKUID: sku1, Quantity: 3}},
	}, userID)
	if err != nil {
		t.Fatalf("final receive: %v", err)
	}
	if po.Status != "received" {
		t.Fatalf("expected received, got %s", po.Status)
	}
}

func TestImportIntercompanyPurchaseOrder(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	skuID := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	warehouseID := uuid.MustParse("11111111-1111-1111-1111-111111111001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	holdCN := uuid.MustParse("77777777-7777-7777-7777-777777777001")

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	svc := purchservice.New(purchrepo.New(pool), stockSvc)

	invRef := "IC-CN-2026-0001"
	po, err := svc.CreatePurchaseOrder(ctx, domain.CreatePOInput{
		SupplierID:             holdCN,
		WarehouseID:            warehouseID,
		ImportOrigin:           "china",
		IntercompanyInvoiceRef: &invRef,
		FreightUSD:             120,
		DutiesUSD:              80,
		Items:                  []domain.CreatePOItemInput{{SKUID: skuID, Quantity: 10, UnitCostUSD: 50}},
	}, userID)
	if err != nil {
		t.Fatalf("create import po: %v", err)
	}
	if po.ImportOrigin != "china" {
		t.Fatalf("expected china origin, got %s", po.ImportOrigin)
	}
	if po.SupplierKind != "intercompany" {
		t.Fatalf("expected intercompany supplier")
	}
	if po.LandedCostUSD != 10*50+120+80 {
		t.Fatalf("landed cost: got %v want %v", po.LandedCostUSD, 600.0)
	}

	// Qualquer exportador cadastrado pode ser vinculado à rota China
	extSupplier, err := svc.CreateSupplier(ctx, domain.CreateSupplierInput{
		Code:      fmt.Sprintf("EXP-CN-%d", time.Now().UnixNano()%999999),
		Name:      "Outra Empresa Exportadora",
		LegalName: strPtr("Shenzhen Example Trading Co., Ltd."),
		Country:   "CN",
		Kind:      "external",
	})
	if err != nil {
		t.Fatalf("custom exporter: %v", err)
	}
	po2, err := svc.CreatePurchaseOrder(ctx, domain.CreatePOInput{
		SupplierID:   extSupplier.ID,
		WarehouseID:  warehouseID,
		ImportOrigin: "china",
		Items:        []domain.CreatePOItemInput{{SKUID: skuID, Quantity: 1, UnitCostUSD: 99}},
	}, userID)
	if err != nil {
		t.Fatalf("create po with custom exporter: %v", err)
	}
	if po2.SupplierID != extSupplier.ID {
		t.Fatalf("expected custom exporter on po")
	}
}

func TestLandedCostOnReceive(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	skuID := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	warehouseID := uuid.MustParse("11111111-1111-1111-1111-111111111001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	svc := purchservice.New(purchrepo.New(pool), stockSvc)

	supplier, err := svc.CreateSupplier(ctx, domain.CreateSupplierInput{
		Code: fmt.Sprintf("EXP-%d", time.Now().UnixNano()%999999),
		Name: "Export Test",
		Country: "CN",
	})
	if err != nil {
		t.Fatalf("supplier: %v", err)
	}

	po, err := svc.CreatePurchaseOrder(ctx, domain.CreatePOInput{
		SupplierID:   supplier.ID,
		WarehouseID:  warehouseID,
		ImportOrigin: "china",
		FreightUSD:   100,
		DutiesUSD:    50,
		Items:        []domain.CreatePOItemInput{{SKUID: skuID, Quantity: 10, UnitCostUSD: 50}},
	}, userID)
	if err != nil {
		t.Fatalf("create po: %v", err)
	}
	if len(po.Items) != 1 || po.Items[0].UnitLandedCostUSD != 65 {
		t.Fatalf("expected landed 65 per unit, got %+v", po.Items[0].UnitLandedCostUSD)
	}

	po, err = svc.SubmitPurchaseOrder(ctx, po.ID)
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	po, err = svc.ReceivePurchaseOrder(ctx, po.ID, domain.ReceivePOInput{
		Items: []domain.ReceivePOItemInput{{SKUID: skuID, Quantity: 2}},
	}, userID)
	if err != nil {
		t.Fatalf("receive: %v", err)
	}

	var unitCost float64
	err = pool.QueryRow(ctx, `
		SELECT unit_cost_usd FROM inventory_units
		WHERE purchase_id = $1 ORDER BY created_at DESC LIMIT 1
	`, po.ID).Scan(&unitCost)
	if err != nil {
		t.Fatalf("query unit: %v", err)
	}
	if unitCost != 65 {
		t.Fatalf("expected stock unit cost 65, got %v", unitCost)
	}
}

func strPtr(s string) *string { return &s }

func seedExtraSKU(t *testing.T, ctx context.Context, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	skuID := uuid.New()
	productID := uuid.MustParse("44444444-4444-4444-4444-444444444001")
	code := fmt.Sprintf("%06d", time.Now().UnixNano()%999999+1)
	_, err := pool.Exec(ctx, `
		INSERT INTO skus (id, product_id, code, name) VALUES ($1, $2, $3, 'SKU Teste Multi PO')
		ON CONFLICT (id) DO NOTHING
	`, skuID, productID, code)
	if err != nil {
		t.Fatalf("seed sku2: %v", err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO sku_prices (sku_id, cost_usd, min_price_usd, price_b2c_usd, price_b2b_usd, price_reseller_usd)
		VALUES ($1, 20, 15, 49.99, 39.99, 35.99)
		ON CONFLICT (sku_id) DO NOTHING
	`, skuID)
	if err != nil {
		t.Fatalf("seed sku2 price: %v", err)
	}
	return skuID
}
