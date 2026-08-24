package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/feed"
	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/repository"
	pricingdomain "github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Postgres
	cfg  domain.FeedConfig
}

func New(repo *repository.Postgres, cfg domain.FeedConfig) *Service {
	if cfg.StoreName == "" {
		cfg.StoreName = "Data Center LA"
	}
	if cfg.StoreURL == "" {
		cfg.StoreURL = "https://datacenterla.com"
	}
	if cfg.ProductURLPrefix == "" {
		cfg.ProductURLPrefix = strings.TrimRight(cfg.StoreURL, "/") + "/produto/"
	}
	if cfg.BuyURLPrefix == "" {
		cfg.BuyURLPrefix = strings.TrimRight(cfg.StoreURL, "/") + "/comprar/"
	}
	return &Service{repo: repo, cfg: cfg}
}

func DefaultConfig() domain.FeedConfig {
	return domain.FeedConfig{
		StoreName: "Data Center LA",
		StoreURL:  "https://datacenterla.com",
	}
}

func (s *Service) Config() domain.FeedConfig {
	return s.cfg
}

func (s *Service) GetCachedFeed(ctx context.Context) ([]byte, error) {
	return s.repo.GetCachedFeed(ctx, domain.ChannelComprasParaguai)
}

func (s *Service) GetFeedMeta(ctx context.Context) (map[string]any, error) {
	meta, err := s.repo.GetCacheMeta(ctx, domain.ChannelComprasParaguai)
	if err == nil {
		return map[string]any{
			"item_count":    meta.ItemCount,
			"skipped_count": meta.SkippedCount,
			"content_hash":  meta.ContentHash,
			"updated_at":    meta.UpdatedAt,
			"cached":        true,
		}, nil
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}
	result, err := s.buildFeed(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"item_count":    result.ItemCount,
		"skipped_count": result.SkippedCount,
		"skipped":       result.Skipped,
		"content_hash":  result.ContentHash,
		"cached":        false,
	}, nil
}

func (s *Service) GenerateFeed(ctx context.Context) (*domain.FeedResult, error) {
	result, err := s.buildFeed(ctx)
	if err != nil {
		return nil, err
	}
	return result.FeedResult, nil
}

func (s *Service) SyncFeed(ctx context.Context, trigger string) (*domain.FeedResult, error) {
	start := time.Now()
	result, err := s.buildFeed(ctx)
	if err != nil {
		logID, _ := s.repo.CreateSyncLog(ctx, repository.CreateSyncLogInput{
			Channel: domain.ChannelComprasParaguai, Status: "failed",
			TriggerSource: trigger, DurationMS: int(time.Since(start).Milliseconds()),
			ErrorMessage: strPtr(err.Error()),
		})
		return &domain.FeedResult{SyncLogID: &logID}, err
	}

	prevHash, _ := s.repo.LastContentHash(ctx, domain.ChannelComprasParaguai)
	status := "success"
	if result.SkippedCount > 0 {
		status = "partial"
	}

	logID, err := s.repo.CreateSyncLog(ctx, repository.CreateSyncLogInput{
		Channel:       domain.ChannelComprasParaguai,
		Status:        status,
		ItemCount:     result.ItemCount,
		SkippedCount:  result.SkippedCount,
		ContentHash:   result.ContentHash,
		DurationMS:    int(time.Since(start).Milliseconds()),
		TriggerSource: trigger,
	})
	if err != nil {
		return nil, err
	}
	result.SyncLogID = &logID

	for _, sk := range result.Skipped {
		reason := sk.Reason
		_ = s.repo.InsertSyncLogEntry(ctx, logID, sk.SKUCode, "skipped", &reason, nil)
	}

	hashChanged := prevHash == nil || *prevHash != result.ContentHash
	if hashChanged {
		for _, item := range result.includedItems {
			_ = s.repo.InsertSyncLogEntry(ctx, logID, item.SKUCode, "included", nil, map[string]any{
				"preco": item.PriceB2CUSD, "estoque": item.StockAvailable,
			})
		}
	} else {
		_ = s.repo.InsertSyncLogEntry(ctx, logID, "-", "unchanged", strPtr("feed idêntico ao anterior"), nil)
	}

	if err := s.repo.SaveCache(ctx, domain.ChannelComprasParaguai, result.ContentHash, result.XML, result.ItemCount, result.SkippedCount); err != nil {
		return nil, err
	}

	if s.cfg.WebhookURL != "" && hashChanged {
		if _, err := s.repo.CreateDeliveryJob(ctx, logID, s.cfg.WebhookURL); err != nil {
			return nil, err
		}
	}

	return result.FeedResult, nil
}

func (s *Service) GetDiagnostics(ctx context.Context) (*domain.FeedDiagnostics, error) {
	rows, err := s.repo.ListFeedDiagnosticRows(ctx)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	diag := &domain.FeedDiagnostics{Items: make([]domain.FeedDiagnosticItem, 0, len(rows))}
	for _, row := range rows {
		if !row.PublishComprasParaguai {
			diag.UnpublishedCount++
			diag.Items = append(diag.Items, domain.FeedDiagnosticItem{
				SKUCode:        row.SKUCode,
				Status:         "unpublished",
				Reason:         "publish_compras_paraguai=false",
				StockAvailable: row.StockAvailable,
				Published:      false,
			})
			continue
		}
		_, reason := mapRow(row, s.cfg)
		item := domain.FeedDiagnosticItem{
			SKUCode:        row.SKUCode,
			StockAvailable: row.StockAvailable,
			Published:      true,
		}
		if row.PriceB2CUSD != nil {
			item.PriceB2CUSD = *row.PriceB2CUSD
			if promoActiveRow(row, now) && row.PricePromoUSD != nil {
				item.PriceB2CUSD = *row.PricePromoUSD
			}
		}
		if reason != "" {
			item.Status = "skipped"
			item.Reason = reason
			diag.SkippedCount++
		} else {
			item.Status = "included"
			diag.IncludedCount++
		}
		diag.Items = append(diag.Items, item)
	}
	return diag, nil
}

func (s *Service) GetSyncLog(ctx context.Context, id uuid.UUID) (*domain.SyncLogDetail, error) {
	return s.repo.GetSyncLog(ctx, id)
}

type internalFeedResult struct {
	*domain.FeedResult
	includedItems []domain.FeedItem
}

func (s *Service) buildFeed(ctx context.Context) (*internalFeedResult, error) {
	rows, err := s.repo.ListFeedRows(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]domain.FeedItem, 0, len(rows))
	var skipped []domain.SkippedItem
	for _, row := range rows {
		item, reason := mapRow(row, s.cfg)
		if reason != "" {
			skipped = append(skipped, domain.SkippedItem{SKUCode: row.SKUCode, Reason: reason})
			continue
		}
		items = append(items, item)
	}

	xmlBytes, err := feed.Render(s.cfg, items)
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(xmlBytes)
	return &internalFeedResult{
		FeedResult: &domain.FeedResult{
			XML:          xmlBytes,
			ItemCount:    len(items),
			SkippedCount: len(skipped),
			Skipped:      skipped,
			ContentHash:  hex.EncodeToString(hash[:]),
		},
		includedItems: items,
	}, nil
}

func mapRow(row domain.FeedItemRow, cfg domain.FeedConfig) (domain.FeedItem, string) {
	title := strings.TrimSpace(row.ProductName)
	if row.GeneratedDescription != nil && strings.TrimSpace(*row.GeneratedDescription) != "" {
		title = strings.TrimSpace(*row.GeneratedDescription)
	}
	if title == "" {
		return domain.FeedItem{}, "title vazio"
	}

	titleES := pickES(row.GeneratedDescriptionES, row.NameES)
	descES := pickES(row.DescriptionES, row.GeneratedDescriptionES, row.NameES)
	if titleES == "" || descES == "" {
		return domain.FeedItem{}, "tradução ES incompleta (name_es / description_es)"
	}

	if row.PriceB2CUSD == nil || *row.PriceB2CUSD <= 0 {
		return domain.FeedItem{}, "preço B2C ausente"
	}
	if row.StockAvailable < 0 {
		return domain.FeedItem{}, "estoque inválido"
	}

	now := time.Now().UTC()
	price := *row.PriceB2CUSD
	if promoActiveRow(row, now) && row.PricePromoUSD != nil {
		price = *row.PricePromoUSD
	}
	priceIVA := math.Round(price*(1+pricingdomain.TaxRateParaguay)*100) / 100

	imageURL := ""
	if row.ImageURL != nil {
		imageURL = strings.TrimSpace(*row.ImageURL)
	}

	return domain.FeedItem{
		SKUCode:         row.SKUCode,
		Title:           title,
		Description:     title,
		TitleES:         titleES,
		DescriptionES:   descES,
		Brand:           row.Brand,
		PriceB2CUSD:     price,
		PriceWithIVAUSD: priceIVA,
		StockAvailable:  row.StockAvailable,
		ProductURL:      fmt.Sprintf("%s%s", cfg.ProductURLPrefix, row.SKUCode),
		BuyURL:          fmt.Sprintf("%s%s", cfg.BuyURLPrefix, row.SKUCode),
		ImageURL:        imageURL,
		TipoVenda:       "loja+internet",
	}, ""
}

func promoActiveRow(row domain.FeedItemRow, now time.Time) bool {
	if row.PricePromoUSD == nil {
		return false
	}
	if row.PromoStartsAt != nil && now.Before(*row.PromoStartsAt) {
		return false
	}
	if row.PromoEndsAt != nil && now.After(*row.PromoEndsAt) {
		return false
	}
	return true
}

func (s *Service) ListSyncLogs(ctx context.Context, limit int) ([]domain.SyncLog, error) {
	return s.repo.ListSyncLogs(ctx, domain.ChannelComprasParaguai, limit)
}

func pickES(values ...*string) string {
	for _, v := range values {
		if v != nil && strings.TrimSpace(*v) != "" {
			return strings.TrimSpace(*v)
		}
	}
	return ""
}

func strPtr(s string) *string {
	return &s
}
