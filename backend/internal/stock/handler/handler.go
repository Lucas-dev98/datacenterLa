package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/platform/http/labelhttp"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/datacenterla/platform/internal/stock/service"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
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
	invRead := perm("inventory.read")
	invRecv := perm("inventory.receive")
	ordConfirm := perm("sales.orders.confirm")

	r.Get("/health", h.health)
	r.With(invRead).Get("/health/dashboard", h.healthDashboard)
	r.With(invRead).Get("/health/issues", h.listHealthIssues)
	r.With(invRead).Get("/health/expiring-reservations", h.listExpiringReservations)
	r.With(invRecv).Post("/health/scan", h.scanHealth)
	r.With(invRecv).Post("/health/issues/{id}/resolve", h.resolveHealthIssue)

	r.With(perm("inventory.count")).Get("/counts", h.listCounts)
	r.With(perm("inventory.count")).Post("/counts", h.createCount)
	r.With(perm("inventory.count")).Get("/counts/{id}", h.getCount)
	r.With(perm("inventory.count")).Post("/counts/{id}/start", h.startCount)
	r.With(perm("inventory.count")).Post("/counts/{id}/lines", h.addCountLine)
	r.With(perm("inventory.count")).Post("/counts/{id}/complete", h.completeCount)
	r.With(perm("inventory.count")).Post("/counts/{id}/approve", h.approveCount)

	r.With(perm("inventory.adjust")).Get("/adjustments", h.listAdjustments)
	r.With(perm("inventory.adjust")).Post("/adjustments", h.createAdjustment)
	r.With(perm("inventory.adjust")).Post("/adjustments/{id}/approve", h.approveAdjustment)
	r.With(perm("inventory.adjust")).Post("/adjustments/{id}/apply", h.applyAdjustment)
	r.With(invRead).Get("/availability", h.getAvailability)
	r.With(invRead).Get("/units/code/{unit_code}/label", h.getUnitLabel)
	r.With(invRead).Get("/units/code/{unit_code}", h.getUnit)
	r.With(invRecv).Post("/receive", h.receive)
	r.With(invRead).Get("/intake/queue", h.listIntakeQueue)
	r.With(invRecv).Post("/intake/advance", h.advanceIntake)
	r.With(invRecv).Post("/intake/complete", h.completeIntake)
	r.With(invRecv).Post("/units/{unit_id}/transition", h.transitionUnit)
	r.With(invRecv).Post("/units/{unit_id}/release", h.releaseUnit)
	r.With(ordConfirm).Post("/internal/reservations", h.createReservation)
	r.With(ordConfirm).Delete("/internal/reservations/{order_id}", h.releaseReservation)
	r.With(ordConfirm).Post("/internal/reservations/{order_id}/pick", h.startPick)
	r.With(ordConfirm).Post("/internal/reservations/{order_id}/ship", h.ship)
	r.With(ordConfirm).Post("/jobs/expire-reservations", h.expireReservations)
	return r
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) getAvailability(w http.ResponseWriter, r *http.Request) {
	skuID, err := uuid.Parse(r.URL.Query().Get("sku_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	warehouseID, err := uuid.Parse(r.URL.Query().Get("warehouse_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	avail, err := h.svc.GetAvailability(r.Context(), skuID, warehouseID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, avail)
}

func (h *Handler) getUnitLabel(w http.ResponseWriter, r *http.Request) {
	label, err := h.svc.GetUnitLabel(r.Context(), chi.URLParam(r, "unit_code"))
	if err != nil {
		response.Error(w, err)
		return
	}
	if r.URL.Query().Get("include_qr") == "true" {
		b64, err := labelhttp.PNGBase64(label.QRContent, 0)
		if err != nil {
			response.Error(w, err)
			return
		}
		label.QRImagePNGBase64 = b64
	}
	labelhttp.WriteUnitLabel(w, r, *label)
}

func (h *Handler) getUnit(w http.ResponseWriter, r *http.Request) {
	unit, err := h.svc.GetUnitByCode(r.Context(), chi.URLParam(r, "unit_code"))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, unit)
}

type receiveRequest struct {
	WarehouseID uuid.UUID                  `json:"warehouse_id"`
	PurchaseID  *uuid.UUID                 `json:"purchase_id"`
	Items       []domain.ReceiveItemInput  `json:"items"`
}

func (h *Handler) receive(w http.ResponseWriter, r *http.Request) {
	var req receiveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	units, err := h.svc.Receive(r.Context(), service.ReceiveInput{
		WarehouseID: req.WarehouseID,
		PurchaseID:  req.PurchaseID,
		Items:       req.Items,
		CreatedBy:   userID(r),
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"units": units})
}

func (h *Handler) listIntakeQueue(w http.ResponseWriter, r *http.Request) {
	var warehouseID *uuid.UUID
	if wh := r.URL.Query().Get("warehouse_id"); wh != "" {
		id, err := uuid.Parse(wh)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		warehouseID = &id
	}
	limit := 100
	items, err := h.svc.ListIntakeQueue(r.Context(), warehouseID, limit)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

type advanceIntakeRequest struct {
	UnitID     *uuid.UUID `json:"unit_id,omitempty"`
	UnitCode   string     `json:"unit_code,omitempty"`
	LocationID uuid.UUID  `json:"location_id"`
}

func (h *Handler) advanceIntake(w http.ResponseWriter, r *http.Request) {
	var req advanceIntakeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uid := userID(r)
	var loc *uuid.UUID
	if req.LocationID != uuid.Nil {
		loc = &req.LocationID
	}

	if req.UnitID != nil && *req.UnitID != uuid.Nil {
		unit, err := h.svc.AdvanceIntake(r.Context(), *req.UnitID, loc, uid)
		if err != nil {
			response.Error(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"unit": unit})
		return
	}
	code := strings.TrimSpace(req.UnitCode)
	if code == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	unit, err := h.svc.AdvanceIntakeByCode(r.Context(), code, loc, uid)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"unit": unit})
}

type completeIntakeRequest struct {
	UnitIDs    []uuid.UUID `json:"unit_ids"`
	LocationID uuid.UUID   `json:"location_id"`
}

func (h *Handler) completeIntake(w http.ResponseWriter, r *http.Request) {
	var req completeIntakeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if req.LocationID == uuid.Nil || len(req.UnitIDs) == 0 {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if len(req.UnitIDs) == 1 {
		unit, err := h.svc.CompleteIntake(r.Context(), req.UnitIDs[0], req.LocationID, userID(r))
		if err != nil {
			response.Error(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"unit": unit})
		return
	}
	res, err := h.svc.CompleteIntakeBatch(r.Context(), req.UnitIDs, req.LocationID, userID(r))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, res)
}

type transitionRequest struct {
	Status domain.UnitStatus `json:"status"`
}

func (h *Handler) transitionUnit(w http.ResponseWriter, r *http.Request) {
	unitID, err := uuid.Parse(chi.URLParam(r, "unit_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var req transitionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	unit, err := h.svc.TransitionUnit(r.Context(), unitID, req.Status, userID(r), nil)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, unit)
}

type releaseRequest struct {
	LocationID uuid.UUID `json:"location_id"`
}

func (h *Handler) releaseUnit(w http.ResponseWriter, r *http.Request) {
	unitID, err := uuid.Parse(chi.URLParam(r, "unit_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var req releaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	unit, err := h.svc.ReleaseUnit(r.Context(), unitID, req.LocationID, userID(r))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, unit)
}

type reserveRequest struct {
	OrderID   uuid.UUID                `json:"order_id"`
	Items     []domain.ReserveItemInput `json:"items"`
	ExpiresAt *time.Time               `json:"expires_at"`
}

func (h *Handler) createReservation(w http.ResponseWriter, r *http.Request) {
	var req reserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	expires := time.Now().UTC().Add(48 * time.Hour)
	if req.ExpiresAt != nil {
		expires = *req.ExpiresAt
	}
	reservations, err := h.svc.CreateReservation(r.Context(), service.ReserveInput{
		OrderID:   req.OrderID,
		Items:     req.Items,
		ExpiresAt: expires,
		CreatedBy: userID(r),
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"reservations": reservations})
}

func (h *Handler) releaseReservation(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.ReleaseReservationByOrder(r.Context(), orderID, userID(r), "order cancelled"); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) startPick(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.StartPick(r.Context(), orderID, userID(r)); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ship(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.Ship(r.Context(), orderID, userID(r)); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) expireReservations(w http.ResponseWriter, r *http.Request) {
	n, err := h.svc.ExpireReservations(r.Context(), userID(r), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int{"expired": n})
}

func userID(r *http.Request) uuid.UUID {
	if uc, ok := authmiddleware.UserFromContext(r.Context()); ok {
		return uuid.MustParse(uc.UserID)
	}
	header := r.Header.Get("X-User-ID")
	if header == "" {
		return uuid.MustParse("00000000-0000-0000-0000-000000000001")
	}
	id, err := uuid.Parse(header)
	if err != nil {
		return uuid.MustParse("00000000-0000-0000-0000-000000000001")
	}
	return id
}

func (h *Handler) healthDashboard(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetHealthOverview(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func (h *Handler) listHealthIssues(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	items, err := h.svc.ListHealthIssues(r.Context(), status, 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listExpiringReservations(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListExpiringReservations(r.Context(), 48, 20)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) scanHealth(w http.ResponseWriter, r *http.Request) {
	n, err := h.svc.ScanHealthIssues(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int{"detected": n})
}

func (h *Handler) resolveHealthIssue(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Notes string `json:"notes"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := h.svc.ResolveHealthIssue(r.Context(), id, userID(r), body.Notes); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listCounts(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListStockCounts(r.Context(), 30)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createCount(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WarehouseID uuid.UUID `json:"warehouse_id"`
		CountType   string    `json:"count_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.CreateStockCount(r.Context(), domain.CreateCountInput{
		WarehouseID: body.WarehouseID,
		CountType:   body.CountType,
		CreatedBy:   userID(r),
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) getCount(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetStockCount(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) startCount(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.StartStockCount(r.Context(), id); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) addCountLine(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body domain.CountLineInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.AddCountLine(r.Context(), id, body); err != nil {
		response.Error(w, err)
		return
	}
	c, err := h.svc.GetStockCount(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) completeCount(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.CompleteStockCount(r.Context(), id); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) approveCount(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.ApproveStockCount(r.Context(), id, userID(r))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) listAdjustments(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	items, err := h.svc.ListAdjustments(r.Context(), status, 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createAdjustment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WarehouseID       uuid.UUID `json:"warehouse_id"`
		SKUID             uuid.UUID `json:"sku_id"`
		QuantityDelta     int       `json:"quantity_delta"`
		EstimatedValueUSD *float64  `json:"estimated_value_usd"`
		Reason            string    `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	a, err := h.svc.CreateAdjustment(r.Context(), domain.CreateAdjustmentInput{
		WarehouseID: body.WarehouseID, SKUID: body.SKUID, QuantityDelta: body.QuantityDelta,
		EstimatedValueUSD: body.EstimatedValueUSD, Reason: body.Reason, RequestedBy: userID(r),
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, a)
}

func (h *Handler) approveAdjustment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.ApproveAdjustment(r.Context(), id, userID(r)); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) applyAdjustment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.ApplyAdjustment(r.Context(), id, userID(r)); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
