//go:build integration

package service_test

import (
	"context"
	"fmt"
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

var (
	testUserID      = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testCustomerID  = uuid.MustParse("66666666-6666-6666-6666-666666666001")
	testSKUID       = uuid.MustParse("33333333-3333-3333-3333-333333333001")
	testWarehouseID = uuid.MustParse("11111111-1111-1111-1111-111111111001")
	testLocationID  = uuid.MustParse("22222222-2222-2222-2222-222222222001")
)

func TestMain(m *testing.M) {
	if os.Getenv("DATABASE_URL") == "" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestOrderGatewayPaymentShipFlow(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	pricingSvc := pricingservice.New(pricingrepo.New(pool), "")
	salesSvc := salesservice.New(salesrepo.NewPostgres(pool), pricingSvc, stockSvc)
	paySvc := payservice.New(payrepo.New(pool), salesSvc, paygateway.Mock{})

	ensureAvailableStock(t, ctx, stockSvc, 2)

	before, err := stockSvc.GetAvailability(ctx, testSKUID, testWarehouseID)
	if err != nil {
		t.Fatalf("availability before: %v", err)
	}

	order, err := salesSvc.CreateOrder(ctx, salesdomain.CreateOrderInput{
		CustomerID:  testCustomerID,
		Channel:     "erp",
		WarehouseID: testWarehouseID,
		Items:       []salesdomain.LineInput{{SKUID: testSKUID, Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if order.Status != "draft" {
		t.Fatalf("expected draft, got %s", order.Status)
	}

	order, err = salesSvc.ConfirmOrder(ctx, order.ID, testUserID)
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if order.Status != "confirmed" {
		t.Fatalf("expected confirmed, got %s", order.Status)
	}

	pi, err := paySvc.CreateIntent(ctx, order.ID, "mock")
	if err != nil {
		t.Fatalf("create intent: %v", err)
	}
	if pi.Status != "pending" || pi.Provider != "mock" {
		t.Fatalf("unexpected intent: %+v", pi)
	}

	pi, err = paySvc.ConfirmIntent(ctx, pi.ID, testUserID)
	if err != nil {
		t.Fatalf("confirm intent: %v", err)
	}
	if pi.Status != "completed" {
		t.Fatalf("expected completed intent, got %s", pi.Status)
	}

	order, err = salesSvc.GetOrder(ctx, order.ID)
	if err != nil {
		t.Fatalf("get order: %v", err)
	}
	if order.Status != "paid" {
		t.Fatalf("expected paid, got %s", order.Status)
	}

	order, err = salesSvc.ShipOrder(ctx, order.ID, testUserID)
	if err != nil {
		t.Fatalf("ship: %v", err)
	}
	if order.Status != "shipped" {
		t.Fatalf("expected shipped, got %s", order.Status)
	}

	after, err := stockSvc.GetAvailability(ctx, testSKUID, testWarehouseID)
	if err != nil {
		t.Fatalf("availability after: %v", err)
	}
	if after.QtyAvailable != before.QtyAvailable-1 {
		t.Fatalf("expected available %d, got %d", before.QtyAvailable-1, after.QtyAvailable)
	}
	if after.QtyPhysical != before.QtyPhysical-1 {
		t.Fatalf("expected physical %d, got %d", before.QtyPhysical-1, after.QtyPhysical)
	}
}

func TestEcommerceCheckoutPaymentFlow(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	pricingSvc := pricingservice.New(pricingrepo.New(pool), "")
	salesSvc := salesservice.New(salesrepo.NewPostgres(pool), pricingSvc, stockSvc)
	paySvc := payservice.NewWithCart(payrepo.New(pool), salesSvc, salesSvc, paygateway.Mock{})

	ensureAvailableStock(t, ctx, stockSvc, 1)

	before, err := stockSvc.GetAvailability(ctx, testSKUID, testWarehouseID)
	if err != nil {
		t.Fatalf("availability before: %v", err)
	}

	sessionID := fmt.Sprintf("test-cart-%d", os.Getpid())
	_, err = salesSvc.AddToCart(ctx, sessionID, testSKUID, testWarehouseID, 1)
	if err != nil {
		t.Fatalf("add to cart: %v", err)
	}

	email := fmt.Sprintf("shopper-%d@test.local", os.Getpid())
	order, err := salesSvc.CheckoutWithoutPayment(ctx, salesservice.CheckoutInput{
		SessionID:   sessionID,
		Name:        "Shopper Test",
		Email:       &email,
		WarehouseID: testWarehouseID,
		CreatedBy:   testUserID,
	})
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if order.Channel != "ecommerce" {
		t.Fatalf("expected ecommerce channel, got %s", order.Channel)
	}
	if order.Status != "confirmed" {
		t.Fatalf("expected confirmed after checkout, got %s", order.Status)
	}

	pi, err := paySvc.CreateIntent(ctx, order.ID, "mock")
	if err != nil {
		t.Fatalf("create intent: %v", err)
	}
	pi, err = paySvc.ConfirmIntentForSession(ctx, pi.ID, testUserID, sessionID)
	if err != nil {
		t.Fatalf("confirm intent: %v", err)
	}
	if pi.Status != "completed" {
		t.Fatalf("expected completed intent, got %s", pi.Status)
	}

	order, err = salesSvc.GetOrder(ctx, order.ID)
	if err != nil {
		t.Fatalf("get order: %v", err)
	}
	if order.Status != "paid" {
		t.Fatalf("expected paid, got %s", order.Status)
	}

	cart, err := salesSvc.GetCart(ctx, sessionID)
	if err != nil {
		t.Fatalf("get cart: %v", err)
	}
	if len(cart.Items) != 0 {
		t.Fatalf("expected empty cart after payment, got %d items", len(cart.Items))
	}

	after, err := stockSvc.GetAvailability(ctx, testSKUID, testWarehouseID)
	if err != nil {
		t.Fatalf("availability after: %v", err)
	}
	if after.QtyReserved != before.QtyReserved+1 {
		t.Fatalf("expected reserved +1, got reserved %d (before %d)", after.QtyReserved, before.QtyReserved)
	}
}

func TestRMARestockFlow(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	stockSvc := stockservice.New(stockrepo.NewPostgres(pool))
	pricingSvc := pricingservice.New(pricingrepo.New(pool), "")
	salesSvc := salesservice.New(salesrepo.NewPostgres(pool), pricingSvc, stockSvc)

	ensureAvailableStock(t, ctx, stockSvc, 1)

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
	paySvc := payservice.New(payrepo.New(pool), salesSvc, paygateway.Mock{})
	pi, err := paySvc.CreateIntent(ctx, order.ID, "mock")
	if err != nil {
		t.Fatalf("intent: %v", err)
	}
	if _, err = paySvc.ConfirmIntent(ctx, pi.ID, testUserID); err != nil {
		t.Fatalf("pay: %v", err)
	}
	order, err = salesSvc.ShipOrder(ctx, order.ID, testUserID)
	if err != nil {
		t.Fatalf("ship: %v", err)
	}
	if order.Status != "shipped" {
		t.Fatalf("expected shipped, got %s", order.Status)
	}

	beforeAvail, err := stockSvc.GetAvailability(ctx, testSKUID, testWarehouseID)
	if err != nil {
		t.Fatalf("availability before rma: %v", err)
	}

	rma, err := salesSvc.CreateRMA(ctx, salesdomain.CreateRMAInput{
		OrderID:     order.ID,
		Reason:      "defeito",
		RequestedBy: testUserID,
		Items: []salesdomain.CreateRMAItemInput{{
			SKUID:    testSKUID,
			Quantity: 1,
		}},
	})
	if err != nil {
		t.Fatalf("create rma: %v", err)
	}
	if len(rma.Items) == 0 || rma.Items[0].InventoryUnitID == nil {
		t.Fatal("expected RMA item linked to inventory unit")
	}

	rma, err = salesSvc.ApproveRMA(ctx, rma.ID, testUserID)
	if err != nil {
		t.Fatalf("approve: %v", err)
	}
	rma, err = salesSvc.ReceiveRMA(ctx, rma.ID, testUserID)
	if err != nil {
		t.Fatalf("receive: %v", err)
	}
	rma, err = salesSvc.ResolveRMA(ctx, rma.ID, "restock", testUserID)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if rma.Status != "resolved" {
		t.Fatalf("expected resolved, got %s", rma.Status)
	}

	afterAvail, err := stockSvc.GetAvailability(ctx, testSKUID, testWarehouseID)
	if err != nil {
		t.Fatalf("availability after rma: %v", err)
	}
	if afterAvail.QtyAvailable != beforeAvail.QtyAvailable+1 {
		t.Fatalf("expected available +1 after restock, before=%d after=%d", beforeAvail.QtyAvailable, afterAvail.QtyAvailable)
	}
}

func ensureAvailableStock(t *testing.T, ctx context.Context, stockSvc *stockservice.Service, qty int) {
	t.Helper()
	units, err := stockSvc.Receive(ctx, stockservice.ReceiveInput{
		WarehouseID: testWarehouseID,
		Items:       []stockdomain.ReceiveItemInput{{SKUID: testSKUID, Quantity: qty}},
		CreatedBy:   testUserID,
	})
	if err != nil || len(units) != qty {
		t.Fatalf("receive %d units: %v len=%d", qty, err, len(units))
	}
	for i := range units {
		u := &units[i]
		for _, status := range []stockdomain.UnitStatus{stockdomain.StatusInspecting, stockdomain.StatusIdentified} {
			u, err = stockSvc.TransitionUnit(ctx, u.ID, status, testUserID, nil)
			if err != nil {
				t.Fatalf("transition %s: %v", status, err)
			}
		}
		u, err = stockSvc.ReleaseUnit(ctx, u.ID, testLocationID, testUserID)
		if err != nil {
			t.Fatalf("release: %v", err)
		}
		if u.Status != stockdomain.StatusAvailable {
			t.Fatalf("expected available, got %s", u.Status)
		}
	}
}
