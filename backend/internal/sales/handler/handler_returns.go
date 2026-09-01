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

func (h *Handler) listCustomerReturns(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListCustomerReturns(r.Context(), r.URL.Query().Get("status"), r.URL.Query().Get("q"), 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getReturnWindowDays(w http.ResponseWriter, r *http.Request) {
	days, err := h.svc.GetReturnWindowDays(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"return_window_days": days})
}

func (h *Handler) checkReturnWindow(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	days, expires, within, err := h.svc.CheckOrderReturnWindow(r.Context(), orderID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"return_window_days":   days,
		"return_expires_at":    expires,
		"within_return_window": within,
	})
}

func (h *Handler) checkReturnEligibility(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	orderItemID, err := uuid.Parse(r.URL.Query().Get("order_item_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	count, err := h.svc.CountSoldUnitsForOrderItem(r.Context(), orderID, orderItemID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"eligible_units": count,
		"eligible":       count > 0,
	})
}

func (h *Handler) createCustomerReturn(w http.ResponseWriter, r *http.Request) {
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	payloadRaw := strings.TrimSpace(r.FormValue("payload"))
	if payloadRaw == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		OrderID        uuid.UUID                      `json:"order_id"`
		Reason         string                         `json:"reason"`
		ConditionNotes *string                        `json:"condition_notes"`
		Notes          *string                        `json:"notes"`
		Items          []domain.CreateReturnItemInput `json:"items"`
	}
	if err := json.Unmarshal([]byte(payloadRaw), &body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var photos []domain.ReturnPhotoUpload
	for i := 0; i < 5; i++ {
		key := "photo_" + strconv.Itoa(i)
		file, hdr, err := r.FormFile(key)
		if err != nil {
			continue
		}
		fileBody, err := io.ReadAll(io.LimitReader(file, 8<<20))
		file.Close()
		if err != nil || len(fileBody) == 0 {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
		if ext == "" {
			ext = "jpg"
		}
		photos = append(photos, domain.ReturnPhotoUpload{Body: fileBody, Ext: ext})
	}
	ret, err := h.svc.CreateCustomerReturn(r.Context(), domain.CreateCustomerReturnInput{
		OrderID:        body.OrderID,
		Reason:         body.Reason,
		ConditionNotes: body.ConditionNotes,
		Notes:          body.Notes,
		RequestedBy:    uuid.MustParse(uc.UserID),
		Items:          body.Items,
		Photos:         photos,
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, ret)
}

func (h *Handler) getCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	ret, err := h.svc.GetCustomerReturn(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) customerReturnPhotoFile(w http.ResponseWriter, r *http.Request) {
	returnID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	photoID, err := uuid.Parse(chi.URLParam(r, "photo_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	body, contentType, err := h.svc.GetCustomerReturnPhotoFile(r.Context(), returnID, photoID)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(body)
}

func (h *Handler) approveCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	ret, err := h.svc.ApproveCustomerReturn(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) receiveCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	ret, err := h.svc.ReceiveCustomerReturn(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) resolveCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Resolution string `json:"resolution"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	uc, _ := authmiddleware.UserFromContext(r.Context())
	ret, err := h.svc.ResolveCustomerReturn(r.Context(), id, body.Resolution, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}
