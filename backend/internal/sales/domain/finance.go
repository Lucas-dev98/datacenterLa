package domain

type FinanceSummary struct {
	RevenueUSD           float64 `json:"revenue_usd"`
	COGSUSD              float64 `json:"cogs_usd"`
	GrossMarginUSD       float64 `json:"gross_margin_usd"`
	GrossMarginPct       float64 `json:"gross_margin_pct"`
	ReceivablesOpenUSD   float64 `json:"receivables_open_usd"`
	PayablesOpenUSD      float64 `json:"payables_open_usd"`
	ShippedOrdersCount   int     `json:"shipped_orders_count"`
	ImportPOOpenCount    int     `json:"import_po_open_count"`
}

type OrderMarginRow struct {
	OrderID     string  `json:"order_id"`
	OrderNumber string  `json:"order_number"`
	Channel     string  `json:"channel"`
	CustomerName string `json:"customer_name"`
	RevenueUSD  float64 `json:"revenue_usd"`
	COGSUSD     float64 `json:"cogs_usd"`
	MarginUSD   float64 `json:"margin_usd"`
	MarginPct   float64 `json:"margin_pct"`
	Status      string  `json:"status"`
}
