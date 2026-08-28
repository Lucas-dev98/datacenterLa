package domain

import (
	"time"

	"github.com/google/uuid"
)

type AnalyticsPeriod struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

type AnalyticsSummary struct {
	RevenueUSD      float64 `json:"revenue_usd"`
	COGSUSD         float64 `json:"cogs_usd"`
	GrossMarginUSD  float64 `json:"gross_margin_usd"`
	GrossMarginPct  float64 `json:"gross_margin_pct"`
	UnitsSold       int     `json:"units_sold"`
	OrdersCount     int     `json:"orders_count"`
	SKUsSold        int     `json:"skus_sold"`
	ClassACount     int     `json:"class_a_count"`
	ClassBCount     int     `json:"class_b_count"`
	ClassCCount     int     `json:"class_c_count"`
}

type ProductAnalyticsRow struct {
	SKUID            uuid.UUID `json:"sku_id"`
	SKUCode          string    `json:"sku_code"`
	SKUName          string    `json:"sku_name"`
	QtySold          int       `json:"qty_sold"`
	RevenueUSD       float64   `json:"revenue_usd"`
	COGSUSD          float64   `json:"cogs_usd"`
	MarginUSD        float64   `json:"margin_usd"`
	MarginPct        float64   `json:"margin_pct"`
	SharePct         float64   `json:"share_pct"`
	CumulativePct    float64   `json:"cumulative_pct"`
	ABCClass         string    `json:"abc_class"`
}

type ProductSalesRaw struct {
	SKUID      uuid.UUID
	SKUCode    string
	SKUName    string
	QtySold    int
	RevenueUSD float64
	COGSUSD    float64
}

type AnalyticsDashboard struct {
	Period  AnalyticsPeriod       `json:"period"`
	Metric  string                `json:"metric"`
	Channel string                `json:"channel,omitempty"`
	Summary AnalyticsSummary      `json:"summary"`
	Products []ProductAnalyticsRow `json:"products"`
}

type AnalyticsFilter struct {
	From    time.Time
	To      time.Time
	Channel string
	Metric  string
	Limit   int
}
