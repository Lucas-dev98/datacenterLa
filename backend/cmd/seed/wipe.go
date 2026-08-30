package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func wipeTransactional(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE
			customer_return_photos,
			customer_return_items,
			customer_returns,
			rma_test_photos,
			rma_items,
			rma_cases,
			order_ship_photos,
			payments,
			payment_intents,
			accounts_receivable,
			order_items,
			orders,
			quote_items,
			quotes,
			ecommerce_cart_items,
			ecommerce_carts,
			stock_count_lines,
			stock_adjustments,
			stock_counts,
			stock_health_issues,
			inventory_unit_intake_photos,
			intake_test_photos,
			supplier_return_requests,
			stock_intake_batch_photos,
			stock_movements,
			stock_reservations,
			stock_balances,
			inventory_units,
			stock_intake_batches,
			accounts_payable,
			purchase_order_items,
			purchase_orders,
			crm_leads,
			sku_prices,
			price_history,
			product_attribute_values,
			skus,
			products,
			shop_login_codes,
			refresh_tokens,
			feed_delivery_jobs,
			feed_sync_log_entries,
			feed_sync_logs,
			feed_cache,
			customers,
			locations
		RESTART IDENTITY CASCADE
	`)
	if err != nil {
		return fmt.Errorf("truncate: %w", err)
	}

	_, err = pool.Exec(ctx, `
		DELETE FROM user_roles
		WHERE user_id NOT IN (
			'00000000-0000-0000-0000-000000000001',
			'00000000-0000-0000-0000-000000000002'
		)
	`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		DELETE FROM users
		WHERE id NOT IN (
			'00000000-0000-0000-0000-000000000001',
			'00000000-0000-0000-0000-000000000002'
		)
	`)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		DELETE FROM suppliers
		WHERE code NOT IN ('EXPORT-CN', 'EXPORT-US')
	`)
	if err != nil {
		return err
	}

	for _, seq := range []string{
		"sku_code_seq",
		"inventory_unit_code_seq",
		"order_number_seq",
		"quote_number_seq",
		"purchase_order_number_seq",
		"rma_case_number_seq",
		"customer_return_number_seq",
	} {
		if _, err := pool.Exec(ctx, fmt.Sprintf(`SELECT setval('%s', 1, false)`, seq)); err != nil {
			return fmt.Errorf("reset %s: %w", seq, err)
		}
	}
	return nil
}
