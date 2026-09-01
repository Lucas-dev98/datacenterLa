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

func (h *Handler) listRMAs(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListRMAs(r.Context(), r.URL.Query().Get("status"), r.URL.Query().Get("q"), 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getRMAWarrantyDays(w http.ResponseWriter, r *http.Request) {
	days, err := h.svc.GetRMAWarrantyDays(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"warranty_days": days})
}

func (h *Handler) checkRMAWarranty(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	days, expires, within, err := h.svc.CheckOrderWarranty(r.Context(), orderID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"warranty_days":       days,
		"warranty_expires_at": expires,
		"within_warranty":     within,
	})
}

func (h *Handler) checkRMAEligibility(w http.ResponseWriter, r *http.Request) {
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

func (h *Handler) createRMA(w http.ResponseWriter, r *http.Request) {
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
		OrderID         uuid.UUID                   `json:"order_id"`
		Reason          string                      `json:"reason"`
		TestNotes       string                      `json:"test_notes"`
		DefectConfirmed bool                        `json:"defect_confirmed"`
		Notes           *string                     `json:"notes"`
		Items           []domain.CreateRMAItemInput `json:"items"`
	}
	if err := json.Unmarshal([]byte(payloadRaw), &body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}

	var photos []domain.RMATestPhotoUpload
	for i := 0; i < 5; i++ {
		key := "test_photo_" + strconv.Itoa(i)
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
			switch hdr.Header.Get("Content-Type") {
			case "image/png":
				ext = "png"
			case "image/webp":
				ext = "webp"
			default:
				ext = "jpg"
			}
		}
		photos = append(photos, domain.RMATestPhotoUpload{Body: fileBody, Ext: ext})
	}

	c, err := h.svc.CreateRMA(r.Context(), domain.CreateRMAInput{
		OrderID:         body.OrderID,
		Reason:          body.Reason,
		TestNotes:       body.TestNotes,
		DefectConfirmed: body.DefectConfirmed,
		Notes:           body.Notes,
		RequestedBy:     uuid.MustParse(uc.UserID),
		Items:           body.Items,
		TestPhotos:      photos,
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) rmaTestPhotoFile(w http.ResponseWriter, r *http.Request) {
	caseID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	photoID, err := uuid.Parse(chi.URLParam(r, "photo_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	body, contentType, err := h.svc.GetRMATestPhotoFile(r.Context(), caseID, photoID)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(body)
}

func (h *Handler) getRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetRMA(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) approveRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	c, err := h.svc.ApproveRMA(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) receiveRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	c, err := h.svc.ReceiveRMA(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) resolveRMA(w http.ResponseWriter, r *http.Request) {
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
	c, err := h.svc.ResolveRMA(r.Context(), id, body.Resolution, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}
