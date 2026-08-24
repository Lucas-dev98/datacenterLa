package worker

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"time"

	cprepo "github.com/datacenterla/platform/internal/integrations/comprasparaguai/repository"
	cpservice "github.com/datacenterla/platform/internal/integrations/comprasparaguai/service"
	"github.com/google/uuid"
)

var deliveryRetryDelays = []time.Duration{
	1 * time.Minute,
	5 * time.Minute,
	15 * time.Minute,
}

type FeedSyncWorker struct {
	svc      *cpservice.Service
	repo     *cprepo.Postgres
	interval time.Duration
	client   *http.Client
}

func NewFeedSync(svc *cpservice.Service, repo *cprepo.Postgres, interval time.Duration) *FeedSyncWorker {
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	return &FeedSyncWorker{
		svc:      svc,
		repo:     repo,
		interval: interval,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (w *FeedSyncWorker) Run(ctx context.Context) {
	syncTicker := time.NewTicker(w.interval)
	deliveryTicker := time.NewTicker(30 * time.Second)
	defer syncTicker.Stop()
	defer deliveryTicker.Stop()

	w.runSync(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-syncTicker.C:
			w.runSync(ctx)
		case <-deliveryTicker.C:
			w.runDeliveries(ctx)
		}
	}
}

func (w *FeedSyncWorker) runSync(ctx context.Context) {
	start := time.Now()
	result, err := w.svc.SyncFeed(ctx, "scheduled")
	if err != nil {
		log.Printf("[feed-sync] scheduled failed duration=%s err=%v", time.Since(start).Round(time.Millisecond), err)
		return
	}
	log.Printf("[feed-sync] scheduled ok duration=%s items=%d skipped=%d hash=%s",
		time.Since(start).Round(time.Millisecond), result.ItemCount, result.SkippedCount, result.ContentHash)
}

func (w *FeedSyncWorker) runDeliveries(ctx context.Context) {
	jobs, err := w.repo.ClaimPendingDeliveries(ctx, 5)
	if err != nil {
		log.Printf("feed delivery claim: %v", err)
		return
	}
	for _, job := range jobs {
		xml, err := w.repo.GetCachedFeed(ctx, "compras_paraguai")
		if err != nil {
			w.failDelivery(ctx, job.ID, job.Attempts+1, err.Error())
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, job.TargetURL, bytes.NewReader(xml))
		if err != nil {
			w.failDelivery(ctx, job.ID, job.Attempts+1, err.Error())
			continue
		}
		req.Header.Set("Content-Type", "application/xml; charset=utf-8")
		resp, err := w.client.Do(req)
		if err != nil {
			w.failDelivery(ctx, job.ID, job.Attempts+1, err.Error())
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			w.failDelivery(ctx, job.ID, job.Attempts+1, string(body))
			continue
		}
		if err := w.repo.MarkDeliverySuccess(ctx, job.ID); err != nil {
			log.Printf("feed delivery mark success: %v", err)
		} else {
			log.Printf("feed delivered to %s", job.TargetURL)
		}
	}
}

func (w *FeedSyncWorker) failDelivery(ctx context.Context, jobID uuid.UUID, attempts int, msg string) {
	next := time.Now().UTC().Add(15 * time.Minute)
	idx := attempts - 1
	if idx >= 0 && idx < len(deliveryRetryDelays) {
		next = time.Now().UTC().Add(deliveryRetryDelays[idx])
	}
	if err := w.repo.MarkDeliveryRetry(ctx, jobID, attempts, next, msg); err != nil {
		log.Printf("feed delivery mark retry: %v", err)
		return
	}
	log.Printf("feed delivery failed (attempt %d): %s", attempts, msg)
}
