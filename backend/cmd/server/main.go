package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	authhandler "github.com/datacenterla/platform/internal/auth/handler"
	authjwt "github.com/datacenterla/platform/internal/auth/jwt"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	authrepo "github.com/datacenterla/platform/internal/auth/repository"
	authservice "github.com/datacenterla/platform/internal/auth/service"
	"github.com/datacenterla/platform/internal/config"
	"github.com/datacenterla/platform/internal/db"
	cpdomain "github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
	cphandler "github.com/datacenterla/platform/internal/integrations/comprasparaguai/handler"
	cprepo "github.com/datacenterla/platform/internal/integrations/comprasparaguai/repository"
	cpservice "github.com/datacenterla/platform/internal/integrations/comprasparaguai/service"
	labelshandler "github.com/datacenterla/platform/internal/labels/handler"
	paygateway "github.com/datacenterla/platform/internal/payments/gateway"
	payhandler "github.com/datacenterla/platform/internal/payments/handler"
	payrepo "github.com/datacenterla/platform/internal/payments/repository"
	payservice "github.com/datacenterla/platform/internal/payments/service"
	pimhandler "github.com/datacenterla/platform/internal/pim/handler"
	pimrepo "github.com/datacenterla/platform/internal/pim/repository"
	pimservice "github.com/datacenterla/platform/internal/pim/service"
	"github.com/datacenterla/platform/internal/platform/http/ratelimit"
	platformhandler "github.com/datacenterla/platform/internal/platform/handler"
	"github.com/datacenterla/platform/internal/platform/settings"
	"github.com/datacenterla/platform/internal/platform/worker"
	pricinghandler "github.com/datacenterla/platform/internal/pricing/handler"
	pricingrepo "github.com/datacenterla/platform/internal/pricing/repository"
	pricingservice "github.com/datacenterla/platform/internal/pricing/service"
	purchhandler "github.com/datacenterla/platform/internal/purchases/handler"
	purchrepo "github.com/datacenterla/platform/internal/purchases/repository"
	purchservice "github.com/datacenterla/platform/internal/purchases/service"
	saleshandler "github.com/datacenterla/platform/internal/sales/handler"
	salesrepo "github.com/datacenterla/platform/internal/sales/repository"
	salesservice "github.com/datacenterla/platform/internal/sales/service"
	shopauthhandler "github.com/datacenterla/platform/internal/shopauth/handler"
	shopauthjwt "github.com/datacenterla/platform/internal/shopauth/jwt"
	shopauthmiddleware "github.com/datacenterla/platform/internal/shopauth/middleware"
	shopauthrepo "github.com/datacenterla/platform/internal/shopauth/repository"
	shopauthservice "github.com/datacenterla/platform/internal/shopauth/service"
	stockhandler "github.com/datacenterla/platform/internal/stock/handler"
	stockrepo "github.com/datacenterla/platform/internal/stock/repository"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	jwtMgr := authjwt.NewManager(cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)

	stockRepository := stockrepo.NewPostgres(pool)
	stockSvc := stockservice.New(stockRepository)
	stockH := stockhandler.New(stockSvc)

	pimRepository := pimrepo.NewPostgres(pool)
	pimSvc := pimservice.New(pimRepository)
	pimH := pimhandler.New(pimSvc)

	pricingRepository := pricingrepo.New(pool)
	pricingSvc := pricingservice.New(pricingRepository, cfg.ExchangeRateAPIURL)
	pricingH := pricinghandler.New(pricingSvc)

	go func() {
		syncCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := pricingSvc.EnsureTodayExchangeRates(syncCtx); err != nil {
			log.Printf("exchange rates: auto-sync on startup: %v", err)
		}
	}()

	salesRepository := salesrepo.NewPostgres(pool)
	salesSvc := salesservice.New(salesRepository, pricingSvc, stockSvc)

	settingsRepo := settings.New(pool)

	payRepository := payrepo.New(pool)
	payGw := paygateway.NewFromEnv()
	paySvc := payservice.NewWithCart(payRepository, salesSvc, salesSvc, payGw)
	payH := payhandler.New(paySvc)

	shopJWT := shopauthjwt.NewManager(cfg.JWTSecret, 24*time.Hour)
	shopAuthRepo := shopauthrepo.New(pool)
	shopAuthSvc := shopauthservice.New(shopAuthRepo, shopJWT, cfg.JWTSecret)
	shopAuthH := shopauthhandler.New(shopAuthSvc)
	shopAuthMW := shopauthmiddleware.Authenticate(shopJWT)

	salesH := saleshandler.New(salesSvc, paySvc, shopAuthMW, settingsRepo)

	authRepository := authrepo.New(pool)
	authSvc := authservice.New(authRepository, jwtMgr, cfg.JWTIssuer, cfg.MFARequired)
	authH := authhandler.New(authSvc)

	platformH := platformhandler.New(settingsRepo)

	purchRepository := purchrepo.New(pool)
	purchSvc := purchservice.New(purchRepository, stockSvc)
	purchH := purchhandler.New(purchSvc)

	batchH := labelshandler.NewBatch(pimSvc, stockSvc)

	cpRepo := cprepo.New(pool)
	cpSvc := cpservice.New(cpRepo, cpdomain.FeedConfig{
		StoreName:        cfg.FeedStoreName,
		StoreURL:         cfg.FeedStoreURL,
		ProductURLPrefix: cfg.FeedProductURL,
		BuyURLPrefix:     cfg.FeedBuyURL,
		WebhookURL:       cfg.FeedWebhookURL,
		PublicAPIURL:     cfg.PublicAPIURL,
	})
	cpH := cphandler.New(cpSvc)

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-User-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(ratelimit.PublicAPI)

	if dir := resolveProductStaticDir(cfg.ProductStaticDir); dir != "" {
		log.Printf("product images from %s", dir)
		fileServer := http.StripPrefix("/static", http.FileServer(http.Dir(dir)))
		r.Get("/static/*", func(w http.ResponseWriter, req *http.Request) {
			fileServer.ServeHTTP(w, req)
		})
	}

	r.Get("/health/live", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	writeReady := func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json")
		version := os.Getenv("APP_VERSION")
		if version == "" {
			version = "dev"
		}
		if err := pool.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			body, _ := json.Marshal(map[string]string{
				"status":  "unhealthy",
				"db":      "down",
				"version": version,
			})
			_, _ = w.Write(body)
			return
		}
		w.WriteHeader(http.StatusOK)
		body, _ := json.Marshal(map[string]string{
			"status":  "ok",
			"db":      "up",
			"version": version,
		})
		_, _ = w.Write(body)
	}

	r.Get("/health/ready", writeReady)
	r.Get("/health", writeReady)

	r.Get("/api/v1/platform/defaults", platformH.Defaults)

	r.Mount("/api/v1/auth", authH.Routes())
	r.Route("/api/v1/ecommerce", func(r chi.Router) {
		r.Mount("/", salesH.EcommerceRoutes())
		r.Mount("/auth", shopAuthH.Routes())
	})
	r.Mount("/api/v1/ecommerce/payments", payH.EcommerceRoutes())
	r.Mount("/api/v1/integrations/compras-paraguai", cpH.Routes())

	r.Group(func(r chi.Router) {
		r.Use(authmiddleware.Authenticate(jwtMgr))

		r.With(authmiddleware.RequirePermission("labels.batch")).Post("/api/v1/labels/batch", batchH.Batch)

		r.Route("/api/v1/pim", func(r chi.Router) {
			r.Mount("/", pimH.Routes())
		})
		r.Mount("/api/v1/pricing", pricingH.Routes())
		r.Mount("/api/v1/sales", salesH.Routes())
		r.Mount("/api/v1/stock", stockH.Routes())
		r.Mount("/api/v1/purchases", purchH.Routes())
		r.Mount("/api/v1/payments", payH.Routes())

		r.Route("/api/v1/integrations/compras-paraguai/sync", func(r chi.Router) {
			r.With(authmiddleware.RequirePermission("pim.products.read")).Get("/logs", cpH.ListSyncLogs)
			r.With(authmiddleware.RequirePermission("pim.products.read")).Get("/logs/{id}", cpH.GetSyncLog)
			r.With(authmiddleware.RequirePermission("pim.products.read")).Get("/diagnostics", cpH.GetDiagnostics)
			r.With(authmiddleware.RequirePermission("pim.products.write")).Post("/run", cpH.RunSync)
		})
	})

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	outboxCtx, outboxCancel := context.WithCancel(context.Background())
	defer outboxCancel()

	feedSync := func(ctx context.Context, eventType string, payload json.RawMessage) error {
		switch eventType {
		case "stock.available_changed", "stock.unit.available", "stock.unit.created", "stock.shipped",
			"pricing.updated", "pim.publish_changed":
			log.Printf("[feed-sync] trigger=%s payload=%s", eventType, string(payload))
			_, err := cpSvc.SyncFeed(ctx, "outbox:"+eventType)
			return err
		case "sales.order.paid":
			log.Printf("[finance] order paid payload=%s", string(payload))
			return nil
		default:
			log.Printf("[outbox] unhandled event type=%s payload=%s", eventType, string(payload))
			return nil
		}
	}
	go worker.NewOutbox(pool, feedSync).Run(outboxCtx, 30*time.Second)
	go worker.NewFeedSync(cpSvc, cpRepo, cfg.FeedSyncInterval).Run(outboxCtx)
	go runReservationExpiry(stockSvc)

	go func() {
		log.Printf("server listening on %s", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	outboxCancel()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func runReservationExpiry(svc *stockservice.Service) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		n, err := svc.ExpireReservations(ctx, authdomain.SystemUserID, 100)
		cancel()
		if err != nil {
			log.Printf("expire reservations: %v", err)
			continue
		}
		if n > 0 {
			log.Printf("expired %d reservations", n)
		}
	}
}

func resolveProductStaticDir(configured string) string {
	for _, p := range []string{configured, "static", filepath.Join("backend", "static")} {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		st, err := os.Stat(p)
		if err != nil || !st.IsDir() {
			continue
		}
		abs, err := filepath.Abs(p)
		if err != nil {
			return p
		}
		return abs
	}
	log.Printf("product static dir not found; SKU image_url files will 404")
	return ""
}
