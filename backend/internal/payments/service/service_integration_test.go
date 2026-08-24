//go:build integration

package service_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/datacenterla/platform/internal/db"
	paygateway "github.com/datacenterla/platform/internal/payments/gateway"
	payrepo "github.com/datacenterla/platform/internal/payments/repository"
	payservice "github.com/datacenterla/platform/internal/payments/service"
	pricingrepo "github.com/datacenterla/platform/internal/pricing/repository"
	pricingservice "github.com/datacenterla/platform/internal/pricing/service"
	salesdomain "github.com/datacenterla/platform/internal/sales/domain"
	salesrepo "github.com/datacenterla/platform/internal/sales/repository"
	salesservice "github.com/datacenterla/platform/internal/sales/service"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	stockrepo "github.com/datacenterla/platform/internal/stock/repository"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
)

func TestMain(m *testing.M) {
	if os.Getenv("DATABASE_URL") == "" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestPaymentWebhookCompletesIntent(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	testUserID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testCustomerID := uuid.MustParse("66666666-6666-6666-6666-666666666001")
	testSKUID := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	testWarehouseID := uuid.MustParse("11111111-1111-1111-1111-111111111001")
	testLocationID := uuid.MustParse("22222222-2222-2222-2222-222222222001")

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	pricingSvc := pricingservice.New(pricingrepo.New(pool), "")
	salesSvc := salesservice.New(salesrepo.NewPostgres(pool), pricingSvc, stockSvc)
	paySvc := payservice.New(payrepo.New(pool), salesSvc, paygateway.TestWebhook{})

	ensureStock(t, ctx, stockSvc, testSKUID, testWarehouseID, testLocationID, testUserID, 1)

	order, err := salesSvc.CreateOrder(ctx, salesdomain.CreateOrderInput{
		CustomerID:  testCustomerID,
		Channel:     "erp",
		WarehouseID: testWarehouseID,
		Items:       []salesdomain.LineInput{{SKUID: testSKUID, Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	order, err = salesSvc.ConfirmOrder(ctx, order.ID, testUserID)
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}

	pi, err := paySvc.CreateIntent(ctx, order.ID, "mock")
	if err != nil {
		t.Fatalf("create intent: %v", err)
	}
	if pi.ProviderRef == nil || *pi.ProviderRef == "" {
		t.Fatal("expected provider ref on intent")
	}

	payload, _ := json.Marshal(map[string]string{"provider_ref": *pi.ProviderRef})
	if err := paySvc.HandleStripeWebhook(ctx, payload, "test-sig", testUserID); err != nil {
		t.Fatalf("webhook: %v", err)
	}

	order, err = salesSvc.GetOrder(ctx, order.ID)
	if err != nil {
		t.Fatalf("get order: %v", err)
	}
	if order.Status != "paid" {
		t.Fatalf("expected paid after webhook, got %s", order.Status)
	}

	pi, err = paySvc.GetIntent(ctx, pi.ID)
	if err != nil {
		t.Fatalf("get intent: %v", err)
	}
	if pi.Status != "completed" {
		t.Fatalf("expected completed intent, got %s", pi.Status)
	}
}

func ensureStock(t *testing.T, ctx context.Context, stockSvc *stockservice.Service, skuID, warehouseID, locationID, userID uuid.UUID, qty int) {
	t.Helper()
	units, err := stockSvc.Receive(ctx, stockservice.ReceiveInput{
		WarehouseID: warehouseID,
		Items:       []stockdomain.ReceiveItemInput{{SKUID: skuID, Quantity: qty}},
		CreatedBy:   userID,
	})
	if err != nil || len(units) != qty {
		t.Fatalf("receive: %v len=%d", err, len(units))
	}
	for i := range units {
		u := &units[i]
		for _, st := range []stockdomain.UnitStatus{stockdomain.StatusInspecting, stockdomain.StatusIdentified} {
			u, err = stockSvc.TransitionUnit(ctx, u.ID, st, userID, nil)
			if err != nil {
				t.Fatalf("transition: %v", err)
			}
		}
		u, err = stockSvc.ReleaseUnit(ctx, u.ID, locationID, userID)
		if err != nil {
			t.Fatalf("release: %v", err)
		}
		_ = u
	}
}
