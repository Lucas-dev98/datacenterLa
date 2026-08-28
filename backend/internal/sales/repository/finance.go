package repository

import (
	"context"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

func (r *Postgres) ApplyReceivableRefund(ctx context.Context, id uuid.UUID, amountUSD float64) (*domain.Receivable, error) {
	var rcv domain.Receivable
	err := r.pool.QueryRow(ctx, `
		UPDATE accounts_receivable
		SET paid_usd = GREATEST(paid_usd - $2, 0),
		    status = CASE
		        WHEN GREATEST(paid_usd - $2, 0) >= amount_usd THEN 'paid'::receivable_status
		        WHEN GREATEST(paid_usd - $2, 0) > 0 THEN 'partial'::receivable_status
		        ELSE 'open'::receivable_status
		    END,
		    updated_at = now()
		WHERE id = $1
		RETURNING id, order_id, customer_id, amount_usd, paid_usd, due_date::text, status
	`, id, amountUSD).Scan(&rcv.ID, &rcv.OrderID, &rcv.CustomerID, &rcv.AmountUSD, &rcv.PaidUSD, &rcv.DueDate, &rcv.Status)
	return &rcv, err
}

func (r *Postgres) GetFinanceSummary(ctx context.Context) (*domain.FinanceSummary, error) {
	var s domain.FinanceSummary
	err := r.pool.QueryRow(ctx, `
		SELECT
			COALESCE((
				SELECT SUM(o.total_usd) FROM orders o WHERE o.status IN ('shipped', 'delivered')
			), 0),
			COALESCE((
				SELECT SUM(iu.unit_cost_usd)
				FROM inventory_units iu
				JOIN orders o ON o.id = iu.order_id
				WHERE o.status IN ('shipped', 'delivered') AND iu.unit_cost_usd IS NOT NULL
			), 0),
			COALESCE((
				SELECT SUM(amount_usd - paid_usd) FROM accounts_receivable WHERE status IN ('open', 'partial')
			), 0),
			COALESCE((
				SELECT SUM(amount_usd - amount_paid_usd) FROM accounts_payable WHERE status IN ('open', 'partial')
			), 0),
			(SELECT COUNT(*) FROM orders WHERE status IN ('shipped', 'delivered')),
			(SELECT COUNT(*) FROM purchase_orders WHERE import_origin != 'local' AND status NOT IN ('received', 'cancelled'))
	`).Scan(&s.RevenueUSD, &s.COGSUSD, &s.ReceivablesOpenUSD, &s.PayablesOpenUSD,
		&s.ShippedOrdersCount, &s.ImportPOOpenCount)
	if err != nil {
		return nil, err
	}
	s.GrossMarginUSD = roundUSD(s.RevenueUSD - s.COGSUSD)
	if s.RevenueUSD > 0 {
		s.GrossMarginPct = roundUSD((s.GrossMarginUSD / s.RevenueUSD) * 100)
	}
	s.ReceivablesOpenUSD = roundUSD(s.ReceivablesOpenUSD)
	s.PayablesOpenUSD = roundUSD(s.PayablesOpenUSD)
	s.RevenueUSD = roundUSD(s.RevenueUSD)
	s.COGSUSD = roundUSD(s.COGSUSD)
	return &s, nil
}

func (r *Postgres) ListOrderMargins(ctx context.Context, limit int) ([]domain.OrderMarginRow, error) {
	if limit <= 0 {
		limit = 30
	}
	rows, err := r.pool.Query(ctx, `
		SELECT o.id, o.order_number, o.channel::text, c.name, o.total_usd, o.status::text,
		       COALESCE(SUM(iu.unit_cost_usd), 0)
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		LEFT JOIN inventory_units iu ON iu.order_id = o.id AND iu.unit_cost_usd IS NOT NULL
		WHERE o.status IN ('shipped', 'delivered')
		GROUP BY o.id, o.order_number, o.channel, c.name, o.total_usd, o.status, o.created_at
		ORDER BY o.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.OrderMarginRow
	for rows.Next() {
		var row domain.OrderMarginRow
		var revenue, cogs float64
		if err := rows.Scan(&row.OrderID, &row.OrderNumber, &row.Channel, &row.CustomerName,
			&revenue, &row.Status, &cogs); err != nil {
			return nil, err
		}
		row.RevenueUSD = roundUSD(revenue)
		row.COGSUSD = roundUSD(cogs)
		row.MarginUSD = roundUSD(revenue - cogs)
		if revenue > 0 {
			row.MarginPct = roundUSD((row.MarginUSD / revenue) * 100)
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
