package repository

import (
	"context"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
)

func (r *Postgres) ListIntakeQueue(ctx context.Context, warehouseID *uuid.UUID, limit int) ([]domain.IntakeQueueItem, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.public_code, u.sku_id, s.code, s.name, u.warehouse_id, u.status,
		       u.purchase_id, po.po_number, u.unit_cost_usd, u.received_at
		FROM inventory_units u
		JOIN skus s ON s.id = u.sku_id
		LEFT JOIN purchase_orders po ON po.id = u.purchase_id
		WHERE u.status IN ('received', 'inspecting', 'identified')
		  AND ($1::uuid IS NULL OR u.warehouse_id = $1)
		ORDER BY u.received_at NULLS LAST, u.created_at
		LIMIT $2
	`, warehouseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.IntakeQueueItem
	for rows.Next() {
		var item domain.IntakeQueueItem
		if err := rows.Scan(&item.ID, &item.UnitCode, &item.SKUID, &item.SKUCode, &item.SKUName,
			&item.WarehouseID, &item.Status, &item.PurchaseID, &item.PONumber,
			&item.UnitCostUSD, &item.ReceivedAt); err != nil {
			return nil, err
		}
		item.NextAction = nextAction(item.Status)
		out = append(out, item)
	}
	return out, rows.Err()
}

func nextAction(status domain.UnitStatus) string {
	switch status {
	case domain.StatusReceived:
		return "inspecionar"
	case domain.StatusInspecting:
		return "identificar"
	case domain.StatusIdentified:
		return "liberar"
	default:
		return "—"
	}
}
