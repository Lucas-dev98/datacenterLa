package worker

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OutboxHandler func(ctx context.Context, eventType string, payload json.RawMessage) error

type OutboxWorker struct {
	pool    *pgxpool.Pool
	handler OutboxHandler
}

func NewOutbox(pool *pgxpool.Pool, handler OutboxHandler) *OutboxWorker {
	return &OutboxWorker{pool: pool, handler: handler}
}

func (w *OutboxWorker) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := w.processBatch(ctx)
			if err != nil {
				log.Printf("outbox worker: %v", err)
			} else if n > 0 {
				log.Printf("outbox worker: published %d events", n)
			}
		}
	}
}

func (w *OutboxWorker) processBatch(ctx context.Context) (int, error) {
	rows, err := w.pool.Query(ctx, `
		SELECT id, event_type, payload FROM outbox_events
		WHERE published_at IS NULL
		ORDER BY created_at ASC
		LIMIT 50
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type evt struct {
		id        uuid.UUID
		eventType string
		payload   json.RawMessage
	}
	var events []evt
	for rows.Next() {
		var e evt
		if err := rows.Scan(&e.id, &e.eventType, &e.payload); err != nil {
			return 0, err
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	for _, e := range events {
		if w.handler != nil {
			if err := w.handler(ctx, e.eventType, e.payload); err != nil {
				log.Printf("outbox handler %s: %v", e.eventType, err)
				continue
			}
		} else {
			log.Printf("outbox event: type=%s payload=%s", e.eventType, string(e.payload))
		}
		if _, err := w.pool.Exec(ctx, `
			UPDATE outbox_events SET published_at = now() WHERE id = $1 AND published_at IS NULL
		`, e.id); err != nil {
			return 0, err
		}
	}
	return len(events), nil
}
