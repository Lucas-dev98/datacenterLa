package service

import (
	"context"

	"github.com/datacenterla/platform/internal/platform/settings"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

// StorefrontPage is the shop homepage payload assembled from DB settings + catalog.
type StorefrontPage struct {
	Defaults        settings.PlatformDefaults `json:"defaults"`
	FeaturedModels  []domain.CatalogProduct   `json:"featured_models"`
	Featured        []domain.CatalogProduct   `json:"featured"`
	Parts           map[string]domain.CatalogProduct `json:"parts"`
	Content         settings.StorefrontContent `json:"content"`
}

// BuildStorefront loads CMS config from app_settings and resolves SKU codes via catalog queries.
func (s *Service) BuildStorefront(ctx context.Context, warehouseID uuid.UUID, cfg *settings.Repository) (*StorefrontPage, error) {
	var sf settings.StorefrontConfig
	if err := cfg.GetJSON(ctx, settings.KeyStorefront, &sf); err != nil {
		sf = settings.DefaultStorefrontConfig()
	}
	var defs settings.PlatformDefaults
	if err := cfg.GetJSON(ctx, settings.KeyPlatformDefaults, &defs); err != nil {
		defs = settings.DefaultPlatformDefaults()
	}

	allCodes := append([]string{}, sf.FeaturedCodes...)
	if sf.PartCodes.CPU != "" {
		allCodes = append(allCodes, sf.PartCodes.CPU)
	}
	if sf.PartCodes.RAM != "" {
		allCodes = append(allCodes, sf.PartCodes.RAM)
	}
	if sf.PartCodes.SSD != "" {
		allCodes = append(allCodes, sf.PartCodes.SSD)
	}

	picked, err := s.ListCatalog(ctx, warehouseID, nil, "", allCodes)
	if err != nil {
		return nil, err
	}
	byCode := map[string]domain.CatalogProduct{}
	for _, p := range picked {
		byCode[p.SKUCode] = p
	}

	featuredModels := make([]domain.CatalogProduct, 0, len(sf.FeaturedCodes))
	for _, code := range sf.FeaturedCodes {
		if p, ok := byCode[code]; ok {
			featuredModels = append(featuredModels, p)
		}
	}

	catalog, err := s.ListCatalog(ctx, warehouseID, nil, "", nil)
	if err != nil {
		return nil, err
	}
	featured := make([]domain.CatalogProduct, 0, 6)
	for _, p := range catalog {
		if p.Available > 0 {
			featured = append(featured, p)
			if len(featured) >= 6 {
				break
			}
		}
	}

	parts := map[string]domain.CatalogProduct{}
	if p, ok := byCode[sf.PartCodes.CPU]; ok {
		parts["cpu"] = p
	}
	if p, ok := byCode[sf.PartCodes.RAM]; ok {
		parts["ram"] = p
	}
	if p, ok := byCode[sf.PartCodes.SSD]; ok {
		parts["ssd"] = p
	}

	return &StorefrontPage{
		Defaults:       defs,
		FeaturedModels: featuredModels,
		Featured:       featured,
		Parts:          parts,
		Content:        sf.Content,
	}, nil
}
