//go:build integration

package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/datacenterla/platform/internal/db"
	cphandler "github.com/datacenterla/platform/internal/integrations/comprasparaguai/handler"
	cprepo "github.com/datacenterla/platform/internal/integrations/comprasparaguai/repository"
	cpservice "github.com/datacenterla/platform/internal/integrations/comprasparaguai/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestComprasParaguaiFeedEndpoint(t *testing.T) {
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

	productID := uuid.MustParse("44444444-4444-4444-4444-444444444001")
	skuID := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	_, _ = pool.Exec(ctx, `
		UPDATE products SET
			name_es = 'Memoria Samsung DDR4 32GB 3200MHz ECC RDIMM',
			description_es = 'Memoria enterprise Samsung DDR4 32GB ECC RDIMM.',
			generated_description_es = 'Memoria Samsung DDR4 32GB 3200MHz ECC RDIMM 32 GB'
		WHERE id = $1
	`, productID)
	_, _ = pool.Exec(ctx, `
		INSERT INTO sku_prices (sku_id, price_b2c_usd, price_b2b_usd, min_price_usd, cost_usd)
		VALUES ($1, 199.99, 179.99, 150, 120)
		ON CONFLICT (sku_id) DO UPDATE SET price_b2c_usd = 199.99
	`, skuID)
	_, _ = pool.Exec(ctx, `
		UPDATE skus SET publish_compras_paraguai = true WHERE id = $1
	`, skuID)

	repo := cprepo.New(pool)
	svc := cpservice.New(repo, cpservice.DefaultConfig())
	h := cphandler.New(svc)
	r := chi.NewRouter()
	r.Mount("/api/v1/integrations/compras-paraguai", h.Routes())

	result, err := svc.SyncFeed(ctx, "test")
	if err != nil {
		t.Fatalf("sync feed: %v", err)
	}
	if result.ItemCount != 1 {
		t.Fatalf("expected 1 item, got %d skipped=%v", result.ItemCount, result.Skipped)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/compras-paraguai/feed.xml", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, want := range []string{
		"<codigo>000001</codigo>",
		"199.99 USD",
		"<title_es>Memoria Samsung DDR4 32GB 3200MHz ECC RDIMM 32 GB</title_es>",
		"<description_es>Memoria enterprise Samsung DDR4 32GB ECC RDIMM.</description_es>",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("missing %q in feed:\n%s", want, body[:min(800, len(body))])
		}
	}

	logs, err := svc.ListSyncLogs(ctx, 5)
	if err != nil {
		t.Fatalf("list sync logs: %v", err)
	}
	if len(logs) == 0 {
		t.Fatal("expected sync log entry")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
