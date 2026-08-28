package repository

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

func formatAAAPublicCode(seq int64) string {
	s := strconv.FormatInt(seq, 10)
	if len(s) < 4 {
		s = strings.Repeat("0", 4-len(s)) + s
	}
	return "AAA" + s
}

// PeekNextUnitCodes returns the next AAA codes that will be assigned on receive (preview only).
func (r *Postgres) PeekNextUnitCodes(ctx context.Context, count int) ([]string, error) {
	if count <= 0 {
		return nil, nil
	}
	if count > 100 {
		count = 100
	}
	var lastVal int64
	var isCalled bool
	if err := r.pool.QueryRow(ctx, `SELECT last_value, is_called FROM inventory_unit_code_seq`).Scan(&lastVal, &isCalled); err != nil {
		return nil, err
	}
	start := lastVal
	if isCalled {
		start = lastVal + 1
	}
	var maxUsed int
	if err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(SUBSTRING(public_code FROM 4)::INT), 0)
		FROM inventory_units
		WHERE public_code ~ '^AAA[0-9]+$'
	`).Scan(&maxUsed); err != nil {
		return nil, err
	}
	if int64(maxUsed) >= start {
		start = int64(maxUsed) + 1
	}
	out := make([]string, count)
	for i := 0; i < count; i++ {
		out[i] = formatAAAPublicCode(start + int64(i))
	}
	return out, nil
}

func (r *Postgres) NextUnitCodePreview(ctx context.Context) (string, error) {
	codes, err := r.PeekNextUnitCodes(ctx, 1)
	if err != nil {
		return "", err
	}
	if len(codes) == 0 {
		return "", fmt.Errorf("no codes")
	}
	return codes[0], nil
}
