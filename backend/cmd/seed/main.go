package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/datacenterla/platform/internal/config"
	"github.com/datacenterla/platform/internal/db"
	"github.com/joho/godotenv"
)

func main() {
	ifEmpty := flag.Bool("if-empty", false, "skip seed when skus table already has rows")
	flag.Parse()

	_ = godotenv.Load()
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

	if *ifEmpty {
		needs, err := db.NeedsDemoSeed(ctx, pool)
		if err != nil {
			log.Fatalf("check empty: %v", err)
		}
		if !needs {
			fmt.Println("seed skip: database already has catalog data")
			return
		}
	}

	if err := db.ApplyDemoSeeds(ctx, cfg.DatabaseURL); err != nil {
		log.Fatalf("seed: %v", err)
	}

	var skuCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM skus`).Scan(&skuCount); err != nil {
		log.Fatalf("count skus: %v", err)
	}

	fmt.Println("seed ok — dados de demonstração carregados (SQL)")
	fmt.Printf("skus=%d\n", skuCount)
	fmt.Println("warehouse_id=11111111-1111-1111-1111-111111111001")
	fmt.Println("location_id=22222222-2222-2222-2222-222222222001")
	fmt.Println("admin_email=admin@datacenterla.local")
	fmt.Println("admin_password=Admin@12345678")
	fmt.Println("seller_email=ana.benitez@datacenterla.local")
	fmt.Println("stock_email=rodrigo.ferreira@datacenterla.local")
}

func init() {
	if os.Getenv("DATABASE_URL") == "" {
		_ = os.Setenv("DATABASE_URL", "postgres://datacenterla:datacenterla@localhost:5434/datacenterla?sslmode=disable")
	}
}
