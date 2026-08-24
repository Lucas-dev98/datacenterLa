package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const DefaultAPIURL = "https://open.er-api.com/v6/latest/USD"

type Fetcher struct {
	apiURL string
	client *http.Client
}

func NewFetcher(apiURL string) *Fetcher {
	if strings.TrimSpace(apiURL) == "" {
		apiURL = DefaultAPIURL
	}
	return &Fetcher{
		apiURL: apiURL,
		client: &http.Client{Timeout: 12 * time.Second},
	}
}

type marketResponse struct {
	Result             string             `json:"result"`
	BaseCode           string             `json:"base_code"`
	Rates              map[string]float64 `json:"rates"`
	TimeLastUpdateUTC  string             `json:"time_last_update_utc"`
	TimeLastUpdateUnix int64              `json:"time_last_update_unix"`
}

type MarketSnapshot struct {
	BaseCode     string
	Rates        map[string]float64
	ProviderTime time.Time
	ProviderNote string
}

func (f *Fetcher) FetchUSD(ctx context.Context, currencies []string) (*MarketSnapshot, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.apiURL, nil)
	if err != nil {
		return nil, err
	}
	res, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("exchange api status %d", res.StatusCode)
	}
	var payload marketResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if payload.Result != "success" || len(payload.Rates) == 0 {
		return nil, fmt.Errorf("exchange api invalid payload")
	}
	out := make(map[string]float64, len(currencies))
	for _, code := range currencies {
		code = strings.ToUpper(strings.TrimSpace(code))
		if code == "" || code == "USD" {
			continue
		}
		rate, ok := payload.Rates[code]
		if !ok || rate <= 0 {
			return nil, fmt.Errorf("missing rate for %s", code)
		}
		out[code] = rate
	}
	var providerTime time.Time
	if payload.TimeLastUpdateUnix > 0 {
		providerTime = time.Unix(payload.TimeLastUpdateUnix, 0).UTC()
	}
	return &MarketSnapshot{
		BaseCode:     "USD",
		Rates:        out,
		ProviderTime: providerTime,
		ProviderNote: payload.TimeLastUpdateUTC,
	}, nil
}
