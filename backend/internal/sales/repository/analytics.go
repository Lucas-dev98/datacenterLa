package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/sales/domain"
)

func (r *Postgres) GetAnalyticsSummary(ctx context.Context, from, to time.Time, channel string) (*domain.AnalyticsSummary, error) {
	where, args := analyticsOrderFilter("o", from, to, channel)
	var s domain.AnalyticsSummary
	err := r.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT
			COALESCE(SUM(o.total_usd), 0),
			COALESCE((
				SELECT SUM(iu.unit_cost_usd)
				FROM inventory_units iu
				JOIN orders ox ON ox.id = iu.order_id
				WHERE iu.status = 'sold'
				  AND ox.status IN ('shipped', 'delivered')
				  %s
			), 0),
			COALESCE((
				SELECT SUM(oi.quantity)::int
				FROM order_items oi
				JOIN orders ox ON ox.id = oi.order_id
				WHERE ox.status IN ('shipped', 'delivered')
				  %s
			), 0),
			COUNT(*)::int,
			COALESCE((
				SELECT COUNT(DISTINCT oi.sku_id)::int
				FROM order_items oi
				JOIN orders ox ON ox.id = oi.order_id
				WHERE ox.status IN ('shipped', 'delivered')
				  %s
			), 0)
		FROM orders o
		WHERE o.status IN ('shipped', 'delivered')
		  %s
	`, analyticsOrderFilterSQL("ox", from, to, channel), analyticsOrderFilterSQL("ox", from, to, channel),
		analyticsOrderFilterSQL("ox", from, to, channel), where), args...).Scan(
		&s.RevenueUSD, &s.COGSUSD, &s.UnitsSold, &s.OrdersCount, &s.SKUsSold,
	)
	if err != nil {
		return nil, err
	}
	s.RevenueUSD = roundUSD(s.RevenueUSD)
	s.COGSUSD = roundUSD(s.COGSUSD)
	s.GrossMarginUSD = roundUSD(s.RevenueUSD - s.COGSUSD)
	if s.RevenueUSD > 0 {
		s.GrossMarginPct = roundUSD((s.GrossMarginUSD / s.RevenueUSD) * 100)
	}
	return &s, nil
}

func (r *Postgres) ListProductSales(ctx context.Context, from, to time.Time, channel string, limit int) ([]domain.ProductSalesRaw, error) {
	if limit <= 0 {
		limit = 200
	}
	where, args := analyticsOrderFilter("o", from, to, channel)
	args = append(args, limit)
	limitIdx := len(args)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT oi.sku_id, s.code, s.name,
			SUM(oi.quantity)::int,
			COALESCE(SUM(oi.line_total_usd), 0),
			COALESCE(SUM(cogs.unit_cost_usd), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN skus s ON s.id = oi.sku_id
		LEFT JOIN (
			SELECT order_item_id, SUM(unit_cost_usd) AS unit_cost_usd
			FROM inventory_units
			WHERE status = 'sold'
			GROUP BY order_item_id
		) cogs ON cogs.order_item_id = oi.id
		WHERE o.status IN ('shipped', 'delivered')
		  %s
		GROUP BY oi.sku_id, s.code, s.name
		ORDER BY COALESCE(SUM(oi.line_total_usd), 0) DESC, s.code
		LIMIT $%d
	`, where, limitIdx), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ProductSalesRaw
	for rows.Next() {
		var row domain.ProductSalesRaw
		if err := rows.Scan(&row.SKUID, &row.SKUCode, &row.SKUName, &row.QtySold, &row.RevenueUSD, &row.COGSUSD); err != nil {
			return nil, err
		}
		row.RevenueUSD = roundUSD(row.RevenueUSD)
		row.COGSUSD = roundUSD(row.COGSUSD)
		out = append(out, row)
	}
	return out, rows.Err()
}

func analyticsOrderFilter(alias string, from, to time.Time, channel string) (string, []any) {
	return analyticsOrderFilterSQL(alias, from, to, channel), analyticsOrderArgs(from, to, channel)
}

func analyticsOrderFilterSQL(alias string, from, to time.Time, channel string) string {
	parts := []string{
		fmt.Sprintf("AND %s.shipped_at >= $1", alias),
		fmt.Sprintf("AND %s.shipped_at < $2", alias),
	}
	if strings.TrimSpace(channel) != "" {
		parts = append(parts, fmt.Sprintf("AND %s.channel = $3::sales_channel", alias))
	}
	return strings.Join(parts, " ")
}

func analyticsOrderArgs(from, to time.Time, channel string) []any {
	args := []any{from.UTC(), to.UTC()}
	if ch := strings.TrimSpace(channel); ch != "" {
		args = append(args, ch)
	}
	return args
}
