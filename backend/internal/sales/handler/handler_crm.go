package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	activeOnly := r.URL.Query().Get("active_only") == "true"
	limit := 0
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
	var items []domain.Customer
	var total int
	var err error
	if q != "" {
		if limit <= 0 {
			limit = 25
		}
		items, total, err = h.svc.SearchCustomersPaged(r.Context(), q, limit, offset)
	} else {
		items, total, err = h.svc.ListCustomers(r.Context(), activeOnly, limit, offset)
	}
	if err != nil {
		response.Error(w, err)
		return
	}
	if items == nil {
		items = []domain.Customer{}
	}
	resp := map[string]any{"items": items, "total": total}
	if limit > 0 {
		resp["limit"] = limit
		resp["offset"] = offset
	}
	response.JSON(w, http.StatusOK, resp)
}

func (h *Handler) createCustomer(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateCustomerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.CreateCustomer(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) getCustomer(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetCustomer(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) uploadCustomerDocument(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	defer file.Close()
	body, err := io.ReadAll(io.LimitReader(file, 8<<20))
	if err != nil || len(body) == 0 {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
	if ext == "" {
		ct := hdr.Header.Get("Content-Type")
		switch ct {
		case "image/png":
			ext = "png"
		case "image/webp":
			ext = "webp"
		default:
			ext = "jpg"
		}
	}
	c, err := h.svc.SaveCustomerDocument(r.Context(), id, ext, body)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) listLeads(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListLeads(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listWebsiteQuoteRequests(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListWebsiteLeads(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

func (h *Handler) updateWebsiteQuoteStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	l, err := h.svc.UpdateLeadStatus(r.Context(), id, body.Status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, l)
}

func strPtr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func (h *Handler) publicQuote(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Phone   string `json:"phone"`
		Company string `json:"company"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	name := strings.TrimSpace(body.Name)
	email := strings.TrimSpace(body.Email)
	phone := strings.TrimSpace(body.Phone)
	if name == "" || (email == "" && phone == "") {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	notes := strings.TrimSpace(body.Message)
	if notes != "" {
		notes = "Cotação pelo site:\n" + notes
	} else {
		notes = "Cotação pelo site"
	}
	_, err := h.svc.CreateLead(r.Context(), domain.CreateLeadInput{
		Name:    name,
		Email:   strPtr(email),
		Phone:   strPtr(phone),
		Company: strPtr(body.Company),
		Source:  "website",
		Notes:   &notes,
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"ok": true})
}

func (h *Handler) createLead(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateLeadInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	l, err := h.svc.CreateLead(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, l)
}

func (h *Handler) updateLeadStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	l, err := h.svc.UpdateLeadStatus(r.Context(), id, body.Status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, l)
}
