package service

import (
	"context"
	"sort"
	"time"

	"github.com/datacenterla/platform/internal/sales/domain"
)

func (s *Service) GetAnalyticsDashboard(ctx context.Context, in domain.AnalyticsFilter) (*domain.AnalyticsDashboard, error) {
	from, to := normalizeAnalyticsPeriod(in.From, in.To)
	metric := in.Metric
	if metric != "quantity" {
		metric = "revenue"
	}
	limit := in.Limit
	if limit <= 0 {
		limit = 200
	}

	summary, err := s.repo.GetAnalyticsSummary(ctx, from, to, in.Channel)
	if err != nil {
		return nil, err
	}
	raw, err := s.repo.ListProductSales(ctx, from, to, in.Channel, limit)
	if err != nil {
		return nil, err
	}

	products := buildABCRows(raw, metric)
	classA, classB, classC := 0, 0, 0
	for _, p := range products {
		switch p.ABCClass {
		case "A":
			classA++
		case "B":
			classB++
		case "C":
			classC++
		}
	}
	summary.ClassACount = classA
	summary.ClassBCount = classB
	summary.ClassCCount = classC

	return &domain.AnalyticsDashboard{
		Period:   domain.AnalyticsPeriod{From: from, To: to},
		Metric:   metric,
		Channel:  in.Channel,
		Summary:  *summary,
		Products: products,
	}, nil
}

func normalizeAnalyticsPeriod(from, to time.Time) (time.Time, time.Time) {
	now := time.Now().UTC()
	if from.IsZero() && to.IsZero() {
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start, start.AddDate(0, 1, 0)
	}
	if from.IsZero() {
		from = to
	}
	if to.IsZero() {
		to = from
	}
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	endDay := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC)
	end := endDay.AddDate(0, 0, 1)
	if !end.After(start) {
		end = start.AddDate(0, 0, 1)
	}
	return start, end
}

func buildABCRows(raw []domain.ProductSalesRaw, metric string) []domain.ProductAnalyticsRow {
	if len(raw) == 0 {
		return nil
	}

	type sortable struct {
		idx   int
		value float64
	}
	items := make([]sortable, len(raw))
	var totalMetric float64
	for i, row := range raw {
		v := row.RevenueUSD
		if metric == "quantity" {
			v = float64(row.QtySold)
		}
		items[i] = sortable{idx: i, value: v}
		totalMetric += v
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].value == items[j].value {
			return raw[items[i].idx].SKUCode < raw[items[j].idx].SKUCode
		}
		return items[i].value > items[j].value
	})

	out := make([]domain.ProductAnalyticsRow, 0, len(raw))
	var cumulative float64
	for _, item := range items {
		row := raw[item.idx]
		metricValue := row.RevenueUSD
		if metric == "quantity" {
			metricValue = float64(row.QtySold)
		}
		share := 0.0
		if totalMetric > 0 {
			share = (metricValue / totalMetric) * 100
		}
		cumulative += share

		marginUSD := row.RevenueUSD - row.COGSUSD
		marginPct := 0.0
		if row.RevenueUSD > 0 {
			marginPct = (marginUSD / row.RevenueUSD) * 100
		}

		prev := cumulative - share
		abc := "C"
		switch {
		case prev < 80:
			abc = "A"
		case prev < 95:
			abc = "B"
		}

		out = append(out, domain.ProductAnalyticsRow{
			SKUID:         row.SKUID,
			SKUCode:       row.SKUCode,
			SKUName:       row.SKUName,
			QtySold:       row.QtySold,
			RevenueUSD:    row.RevenueUSD,
			COGSUSD:       row.COGSUSD,
			MarginUSD:     roundUSD(marginUSD),
			MarginPct:     roundUSD(marginPct),
			SharePct:      roundUSD(share),
			CumulativePct: roundUSD(cumulative),
			ABCClass:      abc,
		})
	}
	return out
}

func roundUSD(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
