package repository

import (
	"context"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/jackc/pgx/v5"
)

// Repository abstracts persistence for stock domain (enables unit tests with mocks).
type Repository interface {
	WithTx(ctx context.Context, fn func(pgx.Tx) error) error
	CreateUnit(ctx context.Context, tx pgx.Tx, unit *domain.InventoryUnit) error
	InsertMovement(ctx context.Context, tx pgx.Tx, mov *domain.StockMovement) error
	InsertOutbox(ctx context.Context, tx pgx.Tx, eventType string, payload map[string]any) error
}
