package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) searchPOSCustomers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	items, err := h.svc.SearchCustomers(r.Context(), q)
	if err != nil {
		response.Error(w, err)
		return
	}
	if items == nil {
		items = []domain.Customer{}
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createPOSCustomer(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateCustomerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.CreatePOSCustomer(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) getWalkInCustomer(w http.ResponseWriter, r *http.Request) {
	c, err := h.svc.GetWalkInCustomer(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) getPOSExchangeRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.svc.GetPOSExchangeRates(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, rates)
}

func (h *Handler) posCheckout(w http.ResponseWriter, r *http.Request) {
	var in domain.POSCheckoutInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.POSCheckout(r.Context(), in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (h *Handler) posPixInit(w http.ResponseWriter, r *http.Request) {
	var in domain.POSPixInitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	out, err := h.svc.POSPixInit(r.Context(), in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, out)
}

func (h *Handler) posPixConfirm(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.POSPixConfirmInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.POSPixConfirm(r.Context(), orderID, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) posPixCancel(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.POSPixCancel(r.Context(), orderID, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}
