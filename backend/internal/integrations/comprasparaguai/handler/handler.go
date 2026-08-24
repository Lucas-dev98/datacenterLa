package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/service"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/feed.xml", h.feedXML)
	r.Get("/feed", h.feedMeta)
	return r
}

func (h *Handler) feedXML(w http.ResponseWriter, r *http.Request) {
	xml, err := h.svc.GetCachedFeed(r.Context())
	if errors.Is(err, domain.ErrNotFound) {
		result, syncErr := h.svc.SyncFeed(r.Context(), "on_demand")
		if syncErr != nil {
			response.Error(w, syncErr)
			return
		}
		xml = result.XML
	} else if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(xml)
}

func (h *Handler) feedMeta(w http.ResponseWriter, r *http.Request) {
	meta, err := h.svc.GetFeedMeta(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, meta)
}

func (h *Handler) ListSyncLogs(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if q := r.URL.Query().Get("limit"); q != "" {
		if n, err := strconv.Atoi(q); err == nil && n > 0 {
			limit = n
		}
	}
	logs, err := h.svc.ListSyncLogs(r.Context(), limit)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": logs})
}

func (h *Handler) GetSyncLog(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrNotFound)
		return
	}
	log, err := h.svc.GetSyncLog(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, log)
}

func (h *Handler) RunSync(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.SyncFeed(r.Context(), "manual")
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"item_count":    result.ItemCount,
		"skipped_count": result.SkippedCount,
		"skipped":       result.Skipped,
		"content_hash":  result.ContentHash,
		"sync_log_id":   result.SyncLogID,
	})
}

func (h *Handler) GetDiagnostics(w http.ResponseWriter, r *http.Request) {
	diag, err := h.svc.GetDiagnostics(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, diag)
}
