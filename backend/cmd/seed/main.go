package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/datacenterla/platform/internal/auth/service"
	"github.com/datacenterla/platform/internal/config"
	"github.com/datacenterla/platform/internal/db"
	"github.com/google/uuid"
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

	if err := wipeTransactional(ctx, pool); err != nil {
		log.Fatalf("wipe: %v", err)
	}

	ids := &seedIDs{
		Admin:      uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Seller:     uuid.MustParse("00000000-0000-0000-0000-000000000010"),
		Stock:      uuid.MustParse("00000000-0000-0000-0000-000000000011"),
		Warehouse:  uuid.MustParse("11111111-1111-1111-1111-111111111001"),
		LocDefault: uuid.MustParse("22222222-2222-2222-2222-222222222001"),
		LocA01:     uuid.New(),
		LocA02:     uuid.New(),
		LocA04:     uuid.New(),
		LocB01:     uuid.New(),
		LocB02:     uuid.New(),
		LocRecv:    uuid.New(),
		WalkIn:     uuid.MustParse("77777777-7777-7777-7777-777777777001"),
		Nucleo:     uuid.MustParse("66666666-6666-6666-6666-666666666001"),
	}

	if err := seedCategories(ctx, pool); err != nil {
		log.Fatalf("categories: %v", err)
	}

	hash, err := service.HashPassword("Admin@12345678")
	if err != nil {
		log.Fatalf("hash: %v", err)
	}
	if err := seedStaffAndWarehouse(ctx, pool, ids, hash); err != nil {
		log.Fatalf("staff: %v", err)
	}

	skus, err := seedCatalog(ctx, pool)
	if err != nil {
		log.Fatalf("catalog: %v", err)
	}
	customers, err := seedCustomers(ctx, pool, ids)
	if err != nil {
		log.Fatalf("customers: %v", err)
	}
	if err := seedSuppliersAndPOs(ctx, pool, ids, skus); err != nil {
		log.Fatalf("purchases: %v", err)
	}
	if err := seedUnits(ctx, pool, ids, skus); err != nil {
		log.Fatalf("stock: %v", err)
	}
	if err := seedQuotesOrders(ctx, pool, ids, skus, customers); err != nil {
		log.Fatalf("sales: %v", err)
	}
	if err := seedLeadsAndOps(ctx, pool, ids, skus, customers); err != nil {
		log.Fatalf("ops: %v", err)
	}
	if err := seedAppSettings(ctx, pool); err != nil {
		log.Fatalf("settings: %v", err)
	}

	fmt.Println("seed ok — dados de demonstração carregados")
	fmt.Printf("skus=%d\n", len(skus))
	fmt.Printf("warehouse_id=%s\n", ids.Warehouse)
	fmt.Printf("location_id=%s\n", ids.LocDefault)
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
