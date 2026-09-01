package handler

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) listReceivables(w http.ResponseWriter, r *http.Request) {
	limit := 20
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListReceivables(r.Context(), limit, offset, status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetDashboard(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func (h *Handler) recordReceivablePayment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.PaymentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	item, err := h.svc.RecordReceivablePayment(r.Context(), id, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *Handler) listPayables(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPayables(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) financeSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.svc.GetFinanceSummary(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, summary)
}

func (h *Handler) analyticsDashboard(w http.ResponseWriter, r *http.Request) {
	filter := domain.AnalyticsFilter{
		Channel: strings.TrimSpace(r.URL.Query().Get("channel")),
		Metric:  strings.TrimSpace(r.URL.Query().Get("metric")),
		Limit:   200,
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			filter.Limit = n
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("from")); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		filter.From = t
	}
	if v := strings.TrimSpace(r.URL.Query().Get("to")); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		filter.To = t
	}
	data, err := h.svc.GetAnalyticsDashboard(r.Context(), filter)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func (h *Handler) listOrderMargins(w http.ResponseWriter, r *http.Request) {
	limit := 30
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	items, err := h.svc.ListOrderMargins(r.Context(), limit)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) exportOrderMargins(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListOrderMargins(r.Context(), 500)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="margens-pedidos.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"pedido", "cliente", "canal", "receita_usd", "custo_usd", "margem_usd", "margem_pct", "status"})
	for _, m := range items {
		_ = cw.Write([]string{
			m.OrderNumber,
			m.CustomerName,
			m.Channel,
			strconv.FormatFloat(m.RevenueUSD, 'f', 2, 64),
			strconv.FormatFloat(m.COGSUSD, 'f', 2, 64),
			strconv.FormatFloat(m.MarginUSD, 'f', 2, 64),
			strconv.FormatFloat(m.MarginPct, 'f', 1, 64),
			m.Status,
		})
	}
	cw.Flush()
}

func (h *Handler) payPayable(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		AmountUSD float64 `json:"amount_usd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.AmountUSD <= 0 {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.PayPayable(r.Context(), id, body.AmountUSD)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}
