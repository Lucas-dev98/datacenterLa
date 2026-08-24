//go:build integration

package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/datacenterla/platform/internal/db"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/pim/domain"
	pimhandler "github.com/datacenterla/platform/internal/pim/handler"
	"github.com/datacenterla/platform/internal/pim/repository"
	"github.com/datacenterla/platform/internal/pim/service"
	"github.com/go-chi/chi/v5"
)

func TestCreateCadastroEndpoint(t *testing.T) {
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

	repo := repository.NewPostgres(pool)
	svc := service.New(repo)
	h := pimhandler.New(svc)

	r := chi.NewRouter()
	r.Use(authmiddleware.InjectPermissions("00000000-0000-0000-0000-000000000001", "pim.products.read", "pim.products.write"))
	r.Mount("/api/v1/pim", h.Routes())

	cat, err := svc.CreateCategory(ctx, domain.CreateCategoryInput{Code: "MEM-INT", Name: "Memória"})
	if err != nil {
		t.Fatalf("category: %v", err)
	}
	attr, err := svc.CreateCategoryAttribute(ctx, cat.ID, domain.CreateCategoryAttributeInput{
		Code: "capacidade", Name: "Capacidade", DataType: "text", IsRequired: true, SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("attribute: %v", err)
	}

	capacity := "32 GB"
	body := map[string]any{
		"name":                     "Memória DDR4 32GB ECC RDIMM",
		"category_id":              cat.ID.String(),
		"brand":                    "Samsung",
		"publish_compras_paraguai": true,
		"publish_ecommerce":        true,
		"attributes": []map[string]any{
			{
				"category_attribute_id": attr.ID.String(),
				"value_text":            capacity,
			},
		},
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/pim/cadastros", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}

	var result domain.CadastroResult
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if result.Product == nil || result.SKU == nil {
		t.Fatal("missing product or sku in response")
	}
	if len(result.SKU.Code) != 6 {
		t.Fatalf("sku code must be 6 digits, got %q", result.SKU.Code)
	}
	if result.Product.GeneratedDescription == nil || *result.Product.GeneratedDescription == "" {
		t.Fatal("expected generated_description")
	}
	if !strings.Contains(strings.ToUpper(*result.Product.GeneratedDescription), "SAMSUNG") {
		t.Fatalf("description should include brand: %q", *result.Product.GeneratedDescription)
	}
	if result.Label.SKU != result.SKU.Code {
		t.Fatalf("label sku mismatch: %s vs %s", result.Label.SKU, result.SKU.Code)
	}
	if result.Label.QRContent == "" {
		t.Fatal("expected qr_content in label")
	}
}
