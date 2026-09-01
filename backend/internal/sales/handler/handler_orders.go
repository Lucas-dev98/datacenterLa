package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) orderReceipt(w http.ResponseWriter, r *http.Request) {
	h.writeReceipt(w, r, chi.URLParam(r, "id"))
}

func (h *Handler) posOrderReceipt(w http.ResponseWriter, r *http.Request) {
	h.writeReceipt(w, r, chi.URLParam(r, "order_id"))
}

func (h *Handler) writeReceipt(w http.ResponseWriter, r *http.Request, rawID string) {
	id, err := uuid.Parse(rawID)
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	html, err := h.svc.ReceiptHTML(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(html)
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
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
	channel := r.URL.Query().Get("channel")
	search := r.URL.Query().Get("q")
	items, total, err := h.svc.ListOrders(r.Context(), limit, offset, status, channel, search)
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

func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if ok {
		sid := uuid.MustParse(uc.UserID)
		in.SellerID = &sid
	}
	o, err := h.svc.CreateOrder(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.GetOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) confirmOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	o, err := h.svc.ConfirmOrder(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) confirmCredit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	o, err := h.svc.ConfirmCreditOrder(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) recordPayment(w http.ResponseWriter, r *http.Request) {
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
	o, err := h.svc.RecordPayment(r.Context(), id, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) shipOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(16 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}

	o, err := h.svc.GetOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}

	photos := make(map[uuid.UUID]domain.ShipPhotoUpload)
	for _, item := range o.Items {
		key := "photo_" + item.ID.String()
		file, hdr, err := r.FormFile(key)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		body, err := io.ReadAll(io.LimitReader(file, 8<<20))
		file.Close()
		if err != nil || len(body) == 0 {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
		if ext == "" {
			switch hdr.Header.Get("Content-Type") {
			case "image/png":
				ext = "png"
			case "image/webp":
				ext = "webp"
			default:
				ext = "jpg"
			}
		}
		photos[item.ID] = domain.ShipPhotoUpload{Body: body, Ext: ext}
	}

	shipped, err := h.svc.ShipOrderWithPhotos(r.Context(), id, photos, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, shipped)
}

func (h *Handler) orderShipPhotoFile(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	photoID, err := uuid.Parse(chi.URLParam(r, "photo_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	body, contentType, err := h.svc.GetOrderShipPhotoFile(r.Context(), orderID, photoID)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(body)
}

func (h *Handler) cancelOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}
	o, err := h.svc.GetOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	hasCancel := uc.Permissions["sales.orders.cancel"]
	hasWrite := uc.Permissions["sales.orders.write"]
	hasConfirm := uc.Permissions["sales.orders.confirm"]
	switch o.Status {
	case "draft":
		if !hasCancel && !hasWrite {
			response.Error(w, authdomain.ErrForbidden)
			return
		}
	case "confirmed":
		if !hasCancel {
			response.Error(w, authdomain.ErrForbidden)
			return
		}
	case "paid":
		if !hasCancel || !hasConfirm {
			response.Error(w, authdomain.ErrForbidden)
			return
		}
	default:
		response.Error(w, domain.ErrInvalidState)
		return
	}
	cancelled, err := h.svc.CancelOrder(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, cancelled)
}
