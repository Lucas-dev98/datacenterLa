package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/datacenterla/platform/internal/config"
	"github.com/datacenterla/platform/internal/db"
	authservice "github.com/datacenterla/platform/internal/auth/service"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	categoryID := uuid.MustParse("55555555-5555-5555-5555-555555555001")
	productID := uuid.MustParse("44444444-4444-4444-4444-444444444001")
	skuID := uuid.MustParse("33333333-3333-3333-3333-333333333001")
	warehouseID := uuid.MustParse("11111111-1111-1111-1111-111111111001")
	locationID := uuid.MustParse("22222222-2222-2222-2222-222222222001")

	if err := seed(ctx, pool, categoryID, productID, skuID, warehouseID, locationID); err != nil {
		log.Fatalf("seed: %v", err)
	}

	fmt.Println("seed ok")
	fmt.Printf("category_id=%s\n", categoryID)
	fmt.Printf("product_id=%s\n", productID)
	fmt.Printf("sku_id=%s\n", skuID)
	fmt.Printf("sku_code=000001\n")
	fmt.Printf("warehouse_id=%s\n", warehouseID)
	fmt.Printf("location_id=%s\n", locationID)
	fmt.Println("admin_email=admin@datacenterla.local")
	fmt.Println("admin_password=Admin@12345678")
}

func seed(ctx context.Context, pool *pgxpool.Pool, categoryID, productID, skuID, warehouseID, locationID uuid.UUID) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO categories (id, code, name) VALUES ($1, 'MEMORIA', 'Memória')
		ON CONFLICT (id) DO NOTHING
	`, categoryID)
	if err != nil {
		return err
	}
	if err := seedCategories(ctx, pool); err != nil {
		return err
	}

	var productCategoryID uuid.UUID
	err = pool.QueryRow(ctx, `SELECT id FROM categories WHERE code = 'MEM_SERVIDOR'`).Scan(&productCategoryID)
	if err != nil {
		productCategoryID = categoryID
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
		SELECT $1, 'capacidade', 'Capacidade', 'text', true, 1
		WHERE NOT EXISTS (
			SELECT 1 FROM category_attributes WHERE category_id = $1 AND code = 'capacidade'
		)
	`, categoryID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO products (id, name, category_id, brand, manufacturer, generated_description,
		                      name_es, description_es, generated_description_es)
		VALUES ($1, 'Memória Samsung DDR4 32GB 3200MHz ECC RDIMM', $2, 'Samsung', 'Samsung',
		        'Memória Samsung DDR4 32GB 3200MHz ECC RDIMM 32 GB',
		        'Memoria Samsung DDR4 32GB 3200MHz ECC RDIMM',
		        'Memoria enterprise Samsung DDR4 32GB 3200MHz ECC RDIMM para servidores.',
		        'Memoria Samsung DDR4 32GB 3200MHz ECC RDIMM 32 GB')
		ON CONFLICT (id) DO UPDATE SET
			category_id = EXCLUDED.category_id,
			name_es = EXCLUDED.name_es,
			description_es = EXCLUDED.description_es,
			generated_description_es = EXCLUDED.generated_description_es
	`, productID, productCategoryID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO skus (id, product_id, code, name, description, publish_compras_paraguai, publish_ecommerce)
		VALUES ($1, $2, '000001', 'Memória 32GB DDR4 3200 ECC RDIMM Samsung',
		        'Cadastro comercial — memória enterprise Samsung DDR4', true, true)
		ON CONFLICT (id) DO UPDATE SET product_id = EXCLUDED.product_id, code = EXCLUDED.code
	`, skuID, productID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `SELECT setval('sku_code_seq', GREATEST((SELECT MAX(code::INT) FROM skus), 1))`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouses (id, code, name) VALUES ($1, 'DEP01', 'Depósito Principal')
		ON CONFLICT (id) DO NOTHING
	`, warehouseID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO locations (id, warehouse_id, code, aisle, rack, shelf, position)
		VALUES ($1, $2, 'DEP01-A-03-02', 'A', '03', '02', '01')
		ON CONFLICT (warehouse_id, code) DO NOTHING
	`, locationID, warehouseID)
	if err != nil {
		return err
	}

	adminID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	hash, err := authservice.HashPassword("Admin@12345678")
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
		VALUES ($1, 'admin@datacenterla.local', $2, 'Administrador', true, true)
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
	`, adminID, hash)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		VALUES ($1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')
		ON CONFLICT DO NOTHING
	`, adminID)
	if err != nil {
		return err
	}

	b2c := 199.99
	b2b := 179.99
	min := 150.0
	cost := 120.0
	_, err = pool.Exec(ctx, `
		INSERT INTO sku_prices (sku_id, cost_usd, min_price_usd, price_b2c_usd, price_b2b_usd, price_reseller_usd)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (sku_id) DO UPDATE SET
			cost_usd = EXCLUDED.cost_usd,
			min_price_usd = EXCLUDED.min_price_usd,
			price_b2c_usd = EXCLUDED.price_b2c_usd,
			price_b2b_usd = EXCLUDED.price_b2b_usd,
			price_reseller_usd = EXCLUDED.price_reseller_usd
	`, skuID, cost, min, b2c, b2b, 169.99)
	if err != nil {
		return err
	}

	customerID := uuid.MustParse("66666666-6666-6666-6666-666666666001")
	walkInID := uuid.MustParse("77777777-7777-7777-7777-777777777001")
	_, err = pool.Exec(ctx, `
		INSERT INTO customers (id, type, name, email, credit_limit_usd, payment_terms_days, is_active)
		VALUES ($1, 'b2b', 'Cliente Demo Paraguay S.A.', 'cliente@demo.py', 50000, 30, true)
		ON CONFLICT (id) DO NOTHING
	`, customerID)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO customers (id, type, name, email, credit_limit_usd, payment_terms_days, is_active)
		VALUES ($1, 'b2c', 'Consumidor final (balcão)', NULL, 0, 0, true)
		ON CONFLICT (id) DO NOTHING
	`, walkInID)
	return err
}

func seedCategories(ctx context.Context, pool *pgxpool.Pool) error {
	// Hierarquia aplicada pela migration 019; seed garante pais base em ambientes sem migrate prévio.
	parents := []struct{ code, name string }{
		{"MEMORIA", "Memória"},
		{"SSD", "SSD"},
		{"HDD", "HDD"},
		{"GPU", "Placas gráficas"},
		{"PLACA_REDE", "Placa de rede"},
		{"FONTE", "Fonte"},
	}
	for _, c := range parents {
		_, err := pool.Exec(ctx, `
			INSERT INTO categories (code, name)
			VALUES ($1, $2)
			ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true
		`, c.code, c.name)
		if err != nil {
			return err
		}
	}
	return nil
}

func init() {
	if os.Getenv("DATABASE_URL") == "" {
		_ = os.Setenv("DATABASE_URL", "postgres://datacenterla:datacenterla@localhost:5434/datacenterla?sslmode=disable")
	}
}
