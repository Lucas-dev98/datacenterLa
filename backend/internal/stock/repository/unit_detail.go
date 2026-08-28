package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) GetUnitDetailByCode(ctx context.Context, code string) (*domain.UnitDetail, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	var detail domain.UnitDetail
	err := r.pool.QueryRow(ctx, `
		SELECT
			u.id, u.public_code, u.sku_id,
			s.code, s.name, s.product_id,
			p.name,
			COALESCE(NULLIF(TRIM(p.generated_description), ''), NULLIF(TRIM(p.description), '')),
			p.brand, c.name,
			u.warehouse_id, u.status, u.unit_cost_usd,
			u.received_at, u.available_at, u.sold_at,
			u.order_id, u.purchase_id, po.po_number, u.serial_number
		FROM inventory_units u
		JOIN skus s ON s.id = u.sku_id
		JOIN products p ON p.id = s.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN purchase_orders po ON po.id = u.purchase_id
		WHERE u.public_code = $1
	`, code).Scan(
		&detail.ID, &detail.UnitCode, &detail.SKUID,
		&detail.SKUCode, &detail.SKUName, &detail.ProductID,
		&detail.ProductName, &detail.ProductDescription,
		&detail.Brand, &detail.CategoryName,
		&detail.WarehouseID, &detail.Status, &detail.UnitCostUSD,
		&detail.ReceivedAt, &detail.AvailableAt, &detail.SoldAt,
		&detail.OrderID, &detail.PurchaseID, &detail.PONumber, &detail.SerialNumber,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &detail, nil
}
