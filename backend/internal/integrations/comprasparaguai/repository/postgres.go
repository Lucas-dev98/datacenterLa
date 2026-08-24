package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (r *Postgres) ListFeedRows(ctx context.Context) ([]domain.FeedItemRow, error) {
	return r.listFeedRows(ctx, true)
}

func (r *Postgres) ListFeedDiagnosticRows(ctx context.Context) ([]domain.FeedItemRow, error) {
	return r.listFeedRows(ctx, false)
}

func (r *Postgres) listFeedRows(ctx context.Context, publishedOnly bool) ([]domain.FeedItemRow, error) {
	publishFilter := ""
	if publishedOnly {
		publishFilter = "AND s.publish_compras_paraguai = true"
	}
	rows, err := r.pool.Query(ctx, `
		SELECT
			s.id,
			s.code,
			p.name,
			p.generated_description,
			p.name_es,
			p.description_es,
			p.generated_description_es,
			p.brand,
			sp.price_b2c_usd,
			sp.price_promo_usd,
			sp.promo_starts_at,
			sp.promo_ends_at,
			s.image_url,
			COALESCE(SUM(GREATEST(b.qty_physical - b.qty_reserved, 0)), 0)::INT AS stock_available,
			s.publish_compras_paraguai
		FROM skus s
		JOIN products p ON p.id = s.product_id
		LEFT JOIN sku_prices sp ON sp.sku_id = s.id
		LEFT JOIN stock_balances b ON b.sku_id = s.id
		WHERE s.is_active = true
		  AND p.is_active = true
		  `+publishFilter+`
		GROUP BY s.id, s.code, p.name, p.generated_description,
		         p.name_es, p.description_es, p.generated_description_es,
		         p.brand, sp.price_b2c_usd, sp.price_promo_usd, sp.promo_starts_at, sp.promo_ends_at,
		         s.image_url, s.publish_compras_paraguai
		ORDER BY s.code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.FeedItemRow
	for rows.Next() {
		var row domain.FeedItemRow
		if err := rows.Scan(
			&row.SKUID, &row.SKUCode, &row.ProductName, &row.GeneratedDescription,
			&row.NameES, &row.DescriptionES, &row.GeneratedDescriptionES,
			&row.Brand, &row.PriceB2CUSD, &row.PricePromoUSD, &row.PromoStartsAt, &row.PromoEndsAt,
			&row.ImageURL, &row.StockAvailable, &row.PublishComprasParaguai,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Postgres) GetCachedFeed(ctx context.Context, channel string) ([]byte, error) {
	var xml string
	err := r.pool.QueryRow(ctx, `
		SELECT xml_content FROM feed_cache WHERE channel = $1
	`, channel).Scan(&xml)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return []byte(xml), err
}

func (r *Postgres) GetCacheMeta(ctx context.Context, channel string) (*domain.CacheMeta, error) {
	var meta domain.CacheMeta
	err := r.pool.QueryRow(ctx, `
		SELECT item_count, skipped_count, content_hash, updated_at
		FROM feed_cache WHERE channel = $1
	`, channel).Scan(&meta.ItemCount, &meta.SkippedCount, &meta.ContentHash, &meta.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &meta, err
}

func (r *Postgres) SaveCache(ctx context.Context, channel, hash string, xml []byte, itemCount, skipped int) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO feed_cache (channel, xml_content, content_hash, item_count, skipped_count, updated_at)
		VALUES ($1, $2, $3, $4, $5, now())
		ON CONFLICT (channel) DO UPDATE SET
			xml_content = EXCLUDED.xml_content,
			content_hash = EXCLUDED.content_hash,
			item_count = EXCLUDED.item_count,
			skipped_count = EXCLUDED.skipped_count,
			updated_at = now()
	`, channel, string(xml), hash, itemCount, skipped)
	return err
}

func (r *Postgres) LastContentHash(ctx context.Context, channel string) (*string, error) {
	var hash *string
	err := r.pool.QueryRow(ctx, `
		SELECT content_hash FROM feed_sync_logs
		WHERE channel = $1 AND status IN ('success', 'partial')
		ORDER BY created_at DESC LIMIT 1
	`, channel).Scan(&hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return hash, err
}

type CreateSyncLogInput struct {
	Channel       string
	Status        string
	ItemCount     int
	SkippedCount  int
	ContentHash   string
	DurationMS    int
	TriggerSource string
	ErrorMessage  *string
}

func (r *Postgres) CreateSyncLog(ctx context.Context, in CreateSyncLogInput) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		INSERT INTO feed_sync_logs (channel, status, item_count, skipped_count, content_hash, duration_ms, trigger_source, error_message)
		VALUES ($1, $2::feed_sync_status, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, in.Channel, in.Status, in.ItemCount, in.SkippedCount, in.ContentHash, in.DurationMS, in.TriggerSource, in.ErrorMessage,
	).Scan(&id)
	return id, err
}

func (r *Postgres) InsertSyncLogEntry(ctx context.Context, syncID uuid.UUID, skuCode, action string, reason *string, changes map[string]any) error {
	var changesJSON []byte
	if changes != nil {
		var err error
		changesJSON, err = json.Marshal(changes)
		if err != nil {
			return err
		}
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO feed_sync_log_entries (sync_log_id, sku_code, action, reason, changes)
		VALUES ($1, $2, $3, $4, $5)
	`, syncID, skuCode, action, reason, changesJSON)
	return err
}

func (r *Postgres) ListSyncLogs(ctx context.Context, channel string, limit int) ([]domain.SyncLog, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, channel, status::text, item_count, skipped_count, content_hash, duration_ms, trigger_source, error_message, created_at
		FROM feed_sync_logs
		WHERE channel = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, channel, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.SyncLog
	for rows.Next() {
		var l domain.SyncLog
		if err := rows.Scan(&l.ID, &l.Channel, &l.Status, &l.ItemCount, &l.SkippedCount,
			&l.ContentHash, &l.DurationMS, &l.TriggerSource, &l.ErrorMessage, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Postgres) GetSyncLog(ctx context.Context, id uuid.UUID) (*domain.SyncLogDetail, error) {
	var l domain.SyncLogDetail
	err := r.pool.QueryRow(ctx, `
		SELECT id, channel, status::text, item_count, skipped_count, content_hash, duration_ms, trigger_source, error_message, created_at
		FROM feed_sync_logs WHERE id = $1
	`, id).Scan(&l.ID, &l.Channel, &l.Status, &l.ItemCount, &l.SkippedCount,
		&l.ContentHash, &l.DurationMS, &l.TriggerSource, &l.ErrorMessage, &l.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, sku_code, action, reason, changes, created_at
		FROM feed_sync_log_entries WHERE sync_log_id = $1 ORDER BY sku_code
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var e domain.SyncLogEntry
		var changesJSON []byte
		if err := rows.Scan(&e.ID, &e.SKUCode, &e.Action, &e.Reason, &changesJSON, &e.CreatedAt); err != nil {
			return nil, err
		}
		if len(changesJSON) > 0 {
			_ = json.Unmarshal(changesJSON, &e.Changes)
		}
		l.Entries = append(l.Entries, e)
	}
	return &l, rows.Err()
}

func (r *Postgres) CreateDeliveryJob(ctx context.Context, syncID uuid.UUID, targetURL string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		INSERT INTO feed_delivery_jobs (sync_log_id, target_url)
		VALUES ($1, $2)
		RETURNING id
	`, syncID, targetURL).Scan(&id)
	return id, err
}

func (r *Postgres) ClaimPendingDeliveries(ctx context.Context, limit int) ([]domain.DeliveryJob, error) {
	if limit <= 0 {
		limit = 10
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT id, sync_log_id, target_url, status, attempts, max_attempts, next_retry_at, last_error, completed_at, created_at
		FROM feed_delivery_jobs
		WHERE status IN ('pending', 'retry')
		  AND next_retry_at <= now()
		  AND attempts < max_attempts
		ORDER BY next_retry_at ASC
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.DeliveryJob
	for rows.Next() {
		var j domain.DeliveryJob
		if err := rows.Scan(&j.ID, &j.SyncLogID, &j.TargetURL, &j.Status, &j.Attempts, &j.MaxAttempts,
			&j.NextRetryAt, &j.LastError, &j.CompletedAt, &j.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Postgres) MarkDeliverySuccess(ctx context.Context, jobID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE feed_delivery_jobs
		SET status = 'success', completed_at = now(), updated_at = now()
		WHERE id = $1
	`, jobID)
	return err
}

func (r *Postgres) MarkDeliveryRetry(ctx context.Context, jobID uuid.UUID, attempts int, nextRetry time.Time, lastErr string) error {
	status := "retry"
	if attempts >= 3 {
		status = "exhausted"
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE feed_delivery_jobs
		SET status = $2, attempts = $3, next_retry_at = $4, last_error = $5, updated_at = now()
		WHERE id = $1
	`, jobID, status, attempts, nextRetry, lastErr)
	return err
}

func (r *Postgres) GetSyncXML(ctx context.Context, syncID uuid.UUID) ([]byte, error) {
	var hash *string
	err := r.pool.QueryRow(ctx, `SELECT content_hash FROM feed_sync_logs WHERE id = $1`, syncID).Scan(&hash)
	if err != nil {
		return nil, err
	}
	return r.GetCachedFeed(ctx, domain.ChannelComprasParaguai)
}
