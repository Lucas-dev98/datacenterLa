package domain

type UpsertExchangeRateInput struct {
	ToCurrency string  `json:"to_currency"`
	Rate       float64 `json:"rate"`
}

type UpsertExchangeRatesInput struct {
	Rates []UpsertExchangeRateInput `json:"rates"`
}
