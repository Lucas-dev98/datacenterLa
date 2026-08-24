package handler

import (
	"encoding/json"
	"net/http"

	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/datacenterla/platform/internal/pricing/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct{ svc *service.Service }

func New(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	perm := authmiddleware.RequirePermission

	r.With(perm("pim.prices.read")).Get("/skus/{sku_id}", h.get)
	r.With(perm("pim.prices.read")).Get("/skus/{sku_id}/resolve", h.resolve)
	r.With(perm("pim.prices.write")).Put("/skus/{sku_id}", h.upsert)

	r.With(perm("finance.receivables.read")).Get("/exchange-rates/today", h.listTodayExchangeRates)
	r.With(perm("finance.exchange_rates.write")).Post("/exchange-rates/sync", h.syncTodayExchangeRates)

	return r
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	skuID, err := uuid.Parse(chi.URLParam(r, "sku_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.Get(r.Context(), skuID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) resolve(w http.ResponseWriter, r *http.Request) {
	skuID, err := uuid.Parse(chi.URLParam(r, "sku_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	ch := r.URL.Query().Get("channel")
	if ch == "" {
		ch = "b2b"
	}
	p, err := h.svc.Resolve(r.Context(), skuID, ch)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) upsert(w http.ResponseWriter, r *http.Request) {
	skuID, err := uuid.Parse(chi.URLParam(r, "sku_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.UpsertPriceInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	userID, _ := uuid.Parse(uc.UserID)
	p, err := h.svc.Upsert(r.Context(), skuID, userID, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) listTodayExchangeRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.svc.ListTodayExchangeRates(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, rates)
}

func (h *Handler) syncTodayExchangeRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.svc.SyncTodayExchangeRatesFromMarket(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, rates)
}
