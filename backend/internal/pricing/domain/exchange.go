package domain

import "time"

type ExchangeRateQuote struct {
	FromCurrency  string    `json:"from_currency"`
	ToCurrency    string    `json:"to_currency"`
	Rate          float64   `json:"rate"`
	EffectiveDate time.Time `json:"effective_date"`
	Label         string    `json:"label"`
	Symbol        string    `json:"symbol"`
}

type ExchangeRatesToday struct {
	BaseCurrency      string              `json:"base_currency"`
	AsOf              time.Time           `json:"as_of"`
	Rates             []ExchangeRateQuote `json:"rates"`
	Source            string              `json:"source,omitempty"`
	FetchedAt         *time.Time          `json:"fetched_at,omitempty"`
	ProviderUpdatedAt *time.Time          `json:"provider_updated_at,omitempty"`
}

// AcceptedInParaguay — moedas frequentemente usadas no comércio paraguaio.
var AcceptedInParaguay = []struct {
	Code, Label, Symbol string
}{
	{"USD", "Dólar americano", "US$"},
	{"PYG", "Guaraní paraguayo", "₲"},
	{"BRL", "Real brasileiro", "R$"},
	{"ARS", "Peso argentino", "AR$"},
}
