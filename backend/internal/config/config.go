package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL    string
	HTTPAddr       string
	JWTSecret      string
	JWTIssuer      string
	AccessTokenTTL time.Duration
	RefreshTokenTTL time.Duration
	FeedStoreName   string
	FeedStoreURL    string
	FeedProductURL  string
	FeedBuyURL      string
	FeedWebhookURL   string
	FeedSyncInterval time.Duration
	CORSOrigins          []string
	MFARequired          bool
	StripePublishableKey string
	StripeSecretKey      string
	StripeWebhookSecret  string
	ExchangeRateAPIURL   string
}

func Load() Config {
	return Config{
		DatabaseURL:     envOr("DATABASE_URL", "postgres://datacenterla:datacenterla@localhost:5434/datacenterla?sslmode=disable"),
		HTTPAddr:        envOr("HTTP_ADDR", ":8080"),
		JWTSecret:       envOr("JWT_SECRET", "dev-secret-change-in-production-min-32-chars!!"),
		JWTIssuer:       envOr("JWT_ISSUER", "DataCenterLA"),
		AccessTokenTTL:  durationEnv("JWT_ACCESS_TTL", 15*time.Minute),
		RefreshTokenTTL: durationEnv("JWT_REFRESH_TTL", 7*24*time.Hour),
		FeedStoreName:    envOr("FEED_STORE_NAME", "Data Center LA"),
		FeedStoreURL:     envOr("FEED_STORE_URL", "https://datacenterla.com"),
		FeedProductURL:   envOr("FEED_PRODUCT_URL", ""),
		FeedBuyURL:       envOr("FEED_BUY_URL", ""),
		FeedWebhookURL:   envOr("FEED_WEBHOOK_URL", ""),
		FeedSyncInterval: durationEnv("FEED_SYNC_INTERVAL", 15*time.Minute),
		CORSOrigins:      splitEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"),
		MFARequired:          envOr("MFA_REQUIRED", "false") == "true",
		StripePublishableKey: envOr("STRIPE_PUBLISHABLE_KEY", ""),
		StripeSecretKey:      envOr("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret:  envOr("STRIPE_WEBHOOK_SECRET", ""),
		ExchangeRateAPIURL:   envOr("EXCHANGE_RATE_API_URL", "https://open.er-api.com/v6/latest/USD"),
	}
}

func splitEnv(key, fallback string) []string {
	raw := envOr(key, fallback)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
