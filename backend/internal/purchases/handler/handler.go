package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/purchases/domain"
	"github.com/datacenterla/platform/internal/purchases/service"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
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
	perm := authmiddleware.RequirePermission
	read := perm("purchases.read")
	write := perm("purchases.write")
	recv := perm("purchases.receive")

	r.Route("/suppliers", func(r chi.Router) {
		r.With(read).Get("/", h.listSuppliers)
		r.With(write).Post("/", h.createSupplier)
		r.With(read).Get("/{id}", h.getSupplier)
		r.With(write).Put("/{id}", h.updateSupplier)
	})

	r.Route("/orders", func(r chi.Router) {
		r.With(read).Get("/", h.listOrders)
		r.With(write).Post("/", h.createOrder)
		r.With(read).Get("/{id}", h.getOrder)
		r.With(write).Post("/{id}/submit", h.submitOrder)
		r.With(recv).Post("/{id}/receive", h.receiveOrder)
		r.With(recv).Post("/{id}/receive-intake", h.receiveOrderIntake)
		r.With(write).Post("/{id}/cancel", h.cancelOrder)
	})
	return r
}

func (h *Handler) listSuppliers(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListSuppliers(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createSupplier(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateSupplierInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	s, err := h.svc.CreateSupplier(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, s)
}

func (h *Handler) getSupplier(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	s, err := h.svc.GetSupplier(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSupplier(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.UpdateSupplierInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	s, err := h.svc.UpdateSupplier(r.Context(), id, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPurchaseOrders(r.Context(), r.URL.Query().Get("status"), 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	var in domain.CreatePOInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	po, err := h.svc.CreatePurchaseOrder(r.Context(), in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, po)
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	po, err := h.svc.GetPurchaseOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, po)
}

func (h *Handler) submitOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	po, err := h.svc.SubmitPurchaseOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, po)
}

func (h *Handler) receiveOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.ReceivePOInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	po, err := h.svc.ReceivePurchaseOrder(r.Context(), id, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, po)
}

func (h *Handler) receiveOrderIntake(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	raw := strings.TrimSpace(r.FormValue("payload"))
	if raw == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.ReceivePOInput
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var batchPhotos []stockdomain.IntakePhotoUpload
	for i := 0; i < 5; i++ {
		key := "batch_photo_" + strconv.Itoa(i)
		file, hdr, err := r.FormFile(key)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(io.LimitReader(file, 8<<20))
		file.Close()
		if err != nil || len(body) == 0 {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		batchPhotos = append(batchPhotos, stockdomain.IntakePhotoUpload{
			Body: body,
			Ext:  stockservice.PhotoExtFromUpload(hdr.Filename, hdr.Header.Get("Content-Type")),
		})
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	result, err := h.svc.ReceivePurchaseOrderWithIntake(r.Context(), id, in, batchPhotos, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, result)
}

func (h *Handler) cancelOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	po, err := h.svc.CancelPurchaseOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, po)
}
