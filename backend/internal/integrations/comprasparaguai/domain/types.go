package domain

import (
	"time"

	"github.com/google/uuid"
)

const ChannelComprasParaguai = "compras_paraguai"

type FeedItem struct {
	SKUCode              string
	Title                string
	Description          string
	TitleES              string
	DescriptionES        string
	Brand                *string
	PriceB2CUSD          float64
	PriceWithIVAUSD      float64
	StockAvailable       int
	ProductURL           string
	BuyURL               string
	ImageURL             string
	TipoVenda            string
}

type FeedConfig struct {
	StoreName        string
	StoreURL         string
	ProductURLPrefix string
	BuyURLPrefix     string
	WebhookURL       string
	PublicAPIURL     string
}

type FeedResult struct {
	XML          []byte
	ItemCount    int
	SkippedCount int
	Skipped      []SkippedItem
	ContentHash  string
	SyncLogID    *uuid.UUID
}

type SkippedItem struct {
	SKUCode string `json:"sku_code"`
	Reason  string `json:"reason"`
}

type FeedItemRow struct {
	SKUID                    uuid.UUID
	SKUCode                  string
	ProductName              string
	GeneratedDescription     *string
	NameES                   *string
	DescriptionES            *string
	GeneratedDescriptionES   *string
	Brand                    *string
	PriceB2CUSD              *float64
	PricePromoUSD            *float64
	PromoStartsAt            *time.Time
	PromoEndsAt              *time.Time
	ImageURL                 *string
	StockAvailable           int
	PublishComprasParaguai   bool
}

type FeedDiagnosticItem struct {
	SKUCode        string  `json:"sku_code"`
	Status         string  `json:"status"`
	Reason         string  `json:"reason,omitempty"`
	StockAvailable int     `json:"stock_available"`
	PriceB2CUSD    float64 `json:"price_b2c_usd,omitempty"`
	Published      bool    `json:"published"`
}

type FeedDiagnostics struct {
	IncludedCount   int                  `json:"included_count"`
	SkippedCount    int                  `json:"skipped_count"`
	UnpublishedCount int                 `json:"unpublished_count"`
	Items           []FeedDiagnosticItem `json:"items"`
}

type SyncLog struct {
	ID            uuid.UUID `json:"id"`
	Channel       string    `json:"channel"`
	Status        string    `json:"status"`
	ItemCount     int       `json:"item_count"`
	SkippedCount  int       `json:"skipped_count"`
	ContentHash   *string   `json:"content_hash,omitempty"`
	DurationMS    *int      `json:"duration_ms,omitempty"`
	TriggerSource string    `json:"trigger_source"`
	ErrorMessage  *string   `json:"error_message,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type SyncLogEntry struct {
	ID        uuid.UUID      `json:"id"`
	SKUCode   string         `json:"sku_code"`
	Action    string         `json:"action"`
	Reason    *string        `json:"reason,omitempty"`
	Changes   map[string]any `json:"changes,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}

type SyncLogDetail struct {
	SyncLog
	Entries []SyncLogEntry `json:"entries"`
}

type CacheMeta struct {
	ItemCount    int
	SkippedCount int
	ContentHash  string
	UpdatedAt    time.Time
}

type DeliveryJob struct {
	ID          uuid.UUID  `json:"id"`
	SyncLogID   uuid.UUID  `json:"sync_log_id"`
	TargetURL   string     `json:"target_url"`
	Status      string     `json:"status"`
	Attempts    int        `json:"attempts"`
	MaxAttempts int        `json:"max_attempts"`
	NextRetryAt time.Time  `json:"next_retry_at"`
	LastError   *string    `json:"last_error,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}
