//go:build integration

package service_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/datacenterla/platform/internal/db"
	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/datacenterla/platform/internal/stock/repository"
	"github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var userID = uuid.MustParse("00000000-0000-0000-0000-000000000001")

func TestMain(m *testing.M) {
	if os.Getenv("DATABASE_URL") == "" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestReceiveToShipFlow(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	testWarehouse := uuid.New()
	testLocation := uuid.New()
	testSKU := uuid.New()
	seedIDs(t, ctx, pool, testWarehouse, testLocation, testSKU)

	repo := repository.NewPostgres(pool)
	svc := service.New(repo)

	units, err := svc.Receive(ctx, service.ReceiveInput{
		WarehouseID: testWarehouse,
		Items: []domain.ReceiveItemInput{{
			SKUID:    testSKU,
			Quantity: 1,
		}},
		CreatedBy: userID,
	})
	if err != nil || len(units) != 1 {
		t.Fatalf("receive: %v len=%d", err, len(units))
	}
	unit := &units[0]

	for _, status := range []domain.UnitStatus{domain.StatusInspecting, domain.StatusIdentified} {
		unit, err = svc.TransitionUnit(ctx, unit.ID, status, userID, nil)
		if err != nil {
			t.Fatalf("transition %s: %v", status, err)
		}
	}

	unit, err = svc.ReleaseUnit(ctx, unit.ID, testLocation, userID)
	if err != nil {
		t.Fatalf("release: %v", err)
	}
	if unit.Status != domain.StatusAvailable {
		t.Fatalf("expected available got %s", unit.Status)
	}

	avail, err := svc.GetAvailability(ctx, testSKU, testWarehouse)
	if err != nil || avail.QtyAvailable < 1 {
		t.Fatalf("availability: %+v err=%v", avail, err)
	}

	orderID := uuid.New()
	orderItemID := uuid.New()
	_, err = svc.CreateReservation(ctx, service.ReserveInput{
		OrderID:   orderID,
		ExpiresAt: time.Now().UTC().Add(time.Hour),
		Items: []domain.ReserveItemInput{{
			OrderItemID: orderItemID,
			SKUID:       testSKU,
			WarehouseID: testWarehouse,
			Quantity:    1,
		}},
		CreatedBy: userID,
	})
	if err != nil {
		t.Fatalf("reserve: %v", err)
	}

	if err := svc.StartPick(ctx, orderID, userID); err != nil {
		t.Fatalf("pick: %v", err)
	}
	if err := svc.Ship(ctx, orderID, userID); err != nil {
		t.Fatalf("ship: %v", err)
	}

	avail, err = svc.GetAvailability(ctx, testSKU, testWarehouse)
	if err != nil {
		t.Fatalf("availability after ship: %v", err)
	}
	if avail.QtyPhysical != 0 {
		t.Fatalf("expected physical 0 got %d", avail.QtyPhysical)
	}
}

func TestIntakeQueueAfterReceive(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	testWarehouse := uuid.New()
	testLocation := uuid.New()
	testSKU := uuid.New()
	seedIDs(t, ctx, pool, testWarehouse, testLocation, testSKU)

	repo := repository.NewPostgres(pool)
	svc := service.New(repo)

	units, err := svc.Receive(ctx, service.ReceiveInput{
		WarehouseID: testWarehouse,
		Items: []domain.ReceiveItemInput{{
			SKUID:    testSKU,
			Quantity: 2,
		}},
		CreatedBy: userID,
	})
	if err != nil || len(units) != 2 {
		t.Fatalf("receive: %v len=%d", err, len(units))
	}

	queue, err := svc.ListIntakeQueue(ctx, &testWarehouse, 50)
	if err != nil {
		t.Fatalf("list queue: %v", err)
	}
	if len(queue) != 2 {
		t.Fatalf("expected 2 in queue, got %d", len(queue))
	}
	for _, item := range queue {
		if item.Status != domain.StatusReceived {
			t.Fatalf("expected received status, got %s", item.Status)
		}
		if item.NextAction != "inspecionar" {
			t.Fatalf("unexpected next action: %s", item.NextAction)
		}
	}

	res, err := svc.CompleteIntakeBatch(ctx, []uuid.UUID{units[0].ID, units[1].ID}, testLocation, userID)
	if err != nil {
		t.Fatalf("complete batch: %v", err)
	}
	if len(res.Completed) != 2 {
		t.Fatalf("expected 2 completed, got %d (failed: %+v)", len(res.Completed), res.Failed)
	}

	queue, err = svc.ListIntakeQueue(ctx, &testWarehouse, 50)
	if err != nil {
		t.Fatalf("list queue after: %v", err)
	}
	if len(queue) != 0 {
		t.Fatalf("expected empty queue, got %d", len(queue))
	}

	avail, err := svc.GetAvailability(ctx, testSKU, testWarehouse)
	if err != nil || avail.QtyAvailable != 2 {
		t.Fatalf("availability: %+v err=%v", avail, err)
	}
}

func TestAdvanceIntakeSteps(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	testWarehouse := uuid.New()
	testLocation := uuid.New()
	testSKU := uuid.New()
	seedIDs(t, ctx, pool, testWarehouse, testLocation, testSKU)

	svc := service.New(repository.NewPostgres(pool))

	units, err := svc.Receive(ctx, service.ReceiveInput{
		WarehouseID: testWarehouse,
		Items:       []domain.ReceiveItemInput{{SKUID: testSKU, Quantity: 1}},
		CreatedBy:   userID,
	})
	if err != nil || len(units) != 1 {
		t.Fatalf("receive: %v", err)
	}
	unitID := units[0].ID

	u, err := svc.AdvanceIntake(ctx, unitID, nil, userID)
	if err != nil || u.Status != domain.StatusInspecting {
		t.Fatalf("step inspect: %v status=%s", err, u.Status)
	}
	u, err = svc.AdvanceIntake(ctx, unitID, nil, userID)
	if err != nil || u.Status != domain.StatusIdentified {
		t.Fatalf("step identify: %v status=%s", err, u.Status)
	}
	loc := testLocation
	u, err = svc.AdvanceIntake(ctx, unitID, &loc, userID)
	if err != nil || u.Status != domain.StatusAvailable {
		t.Fatalf("step release: %v status=%s", err, u.Status)
	}

	code := units[0].UnitCode
	u, err = svc.AdvanceIntakeByCode(ctx, code, &loc, userID)
	if err == nil {
		t.Fatal("expected error advancing available unit")
	}
}

func TestInsufficientStock(t *testing.T) {
	ctx := context.Background()
	pool, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	testWarehouse := uuid.New()
	testLocation := uuid.New()
	testSKU := uuid.New()
	seedIDs(t, ctx, pool, testWarehouse, testLocation, testSKU)

	repo := repository.NewPostgres(pool)
	svc := service.New(repo)

	_, err = svc.CreateReservation(ctx, service.ReserveInput{
		OrderID: uuid.New(),
		Items: []domain.ReserveItemInput{{
			OrderItemID: uuid.New(),
			SKUID:       testSKU,
			WarehouseID: testWarehouse,
			Quantity:    999,
		}},
		CreatedBy: userID,
	})
	if err == nil {
		t.Fatal("expected insufficient stock error")
	}
}

func seedIDs(t *testing.T, ctx context.Context, pool *pgxpool.Pool, warehouseID, locationID, skuID uuid.UUID) uuid.UUID {
	t.Helper()
	productID := uuid.New()
	_, err := pool.Exec(ctx, `
		INSERT INTO products (id, name) VALUES ($1, 'Test Product')
	`, productID)
	if err != nil {
		t.Fatalf("seed product: %v", err)
	}
	skuNum := fmt.Sprintf("%06d", time.Now().UnixNano()%999999+1)
	_, err = pool.Exec(ctx, `
		INSERT INTO skus (id, product_id, code, name) VALUES ($1, $2, $3, 'Test SKU')
	`, skuID, productID, skuNum)
	if err != nil {
		t.Fatalf("seed sku: %v", err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouses (id, code, name) VALUES ($1, $2, 'Test Warehouse')
	`, warehouseID, "WH-"+warehouseID.String()[:8])
	if err != nil {
		t.Fatalf("seed warehouse: %v", err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO locations (id, warehouse_id, code) VALUES ($1, $2, $3)
	`, locationID, warehouseID, "LOC-"+locationID.String()[:8])
	if err != nil {
		t.Fatalf("seed location: %v", err)
	}
	return productID
}
