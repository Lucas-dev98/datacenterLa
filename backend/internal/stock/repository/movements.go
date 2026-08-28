package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
)

type ListMovementsParams struct {
	WarehouseID  uuid.UUID
	Query        string
	MovementType string
	Limit        int
	Offset       int
}

func (r *Postgres) ListMovements(ctx context.Context, p ListMovementsParams) ([]domain.MovementListItem, int, error) {
	if p.Limit <= 0 {
		p.Limit = 50
	}
	if p.Offset < 0 {
		p.Offset = 0
	}
	p.Query = strings.TrimSpace(strings.ToLower(p.Query))
	p.MovementType = strings.TrimSpace(p.MovementType)

	var filters []string
	var args []any
	args = append(args, p.WarehouseID)
	idx := 2

	if p.Query != "" {
		filters = append(filters, fmt.Sprintf(
			`(LOWER(s.code) LIKE $%d OR LOWER(s.name) LIKE $%d OR LOWER(u.public_code) LIKE $%d)`,
			idx, idx, idx,
		))
		args = append(args, "%"+p.Query+"%")
		idx++
	}
	if p.MovementType != "" {
		filters = append(filters, fmt.Sprintf(`m.movement_type = $%d`, idx))
		args = append(args, p.MovementType)
		idx++
	}

	filterSQL := ""
	if len(filters) > 0 {
		filterSQL = " AND " + strings.Join(filters, " AND ")
	}

	countSQL := `
		SELECT COUNT(*)
		FROM stock_movements m
		JOIN skus s ON s.id = m.sku_id
		LEFT JOIN inventory_units u ON u.id = m.inventory_unit_id
		WHERE m.warehouse_id = $1` + filterSQL

	var total int
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(args, p.Limit, p.Offset)
	limitIdx := len(listArgs) - 1
	offsetIdx := len(listArgs)
	listSQL := fmt.Sprintf(`
		SELECT m.id, m.movement_type, m.sku_id, s.code, s.name, m.warehouse_id,
			m.inventory_unit_id, u.public_code, m.quantity,
			m.unit_status_before, m.unit_status_after,
			m.reference_type, m.reference_id, m.reason, m.created_at
		FROM stock_movements m
		JOIN skus s ON s.id = m.sku_id
		LEFT JOIN inventory_units u ON u.id = m.inventory_unit_id
		WHERE m.warehouse_id = $1%s
		ORDER BY m.created_at DESC
		LIMIT $%d OFFSET $%d
	`, filterSQL, limitIdx, offsetIdx)

	rows, err := r.pool.Query(ctx, listSQL, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.MovementListItem
	for rows.Next() {
		var item domain.MovementListItem
		if err := rows.Scan(
			&item.ID, &item.MovementType, &item.SKUID, &item.SKUCode, &item.SKUName, &item.WarehouseID,
			&item.InventoryUnitID, &item.UnitCode, &item.Quantity,
			&item.StatusBefore, &item.StatusAfter,
			&item.ReferenceType, &item.ReferenceID, &item.Reason, &item.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, item)
	}
	return out, total, rows.Err()
}
