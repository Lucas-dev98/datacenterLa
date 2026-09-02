package main

import (
	"context"
	"fmt"

	"github.com/datacenterla/platform/internal/platform/settings"
	"github.com/jackc/pgx/v5/pgxpool"
)

// seedAppSettings persists storefront CMS and platform defaults in app_settings.
func seedAppSettings(ctx context.Context, pool *pgxpool.Pool) error {
	repo := settings.New(pool)
	if err := repo.SetJSON(ctx, settings.KeyStorefront, settings.DefaultStorefrontConfig()); err != nil {
		return fmt.Errorf("storefront: %w", err)
	}
	if err := repo.SetJSON(ctx, settings.KeyPlatformDefaults, settings.DefaultPlatformDefaults()); err != nil {
		return fmt.Errorf("platform_defaults: %w", err)
	}
	return nil
}
