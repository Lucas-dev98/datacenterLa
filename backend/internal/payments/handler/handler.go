package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	paydomain "github.com/datacenterla/platform/internal/payments/domain"
	"github.com/datacenterla/platform/internal/payments/service"
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
	r.With(authmiddleware.RequirePermission("finance.payments.write")).Post("/intents", h.createIntent)
	r.With(authmiddleware.RequirePermission("finance.payments.write")).Post("/intents/{id}/confirm", h.confirmIntent)
	r.Get("/config", h.publicConfig)
	return r
}

func (h *Handler) EcommerceRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/config", h.publicConfig)
	r.Post("/intents/{id}/confirm", h.confirmIntentPublic)
	r.Post("/webhook/stripe", h.stripeWebhook)
	return r
}

func (h *Handler) publicConfig(w http.ResponseWriter, _ *http.Request) {
	response.JSON(w, http.StatusOK, h.svc.PublicConfig())
}

func (h *Handler) createIntent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OrderID  uuid.UUID `json:"order_id"`
		Provider string    `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == uuid.Nil {
		response.Error(w, paydomain.ErrInvalidInput)
		return
	}
	pi, err := h.svc.CreateIntent(r.Context(), body.OrderID, body.Provider)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, pi)
}

func (h *Handler) confirmIntent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, paydomain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	pi, err := h.svc.ConfirmIntent(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, pi)
}

func (h *Handler) confirmIntentPublic(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, paydomain.ErrInvalidInput)
		return
	}
	var body struct {
		SessionID string `json:"session_id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	pi, err := h.svc.ConfirmIntentForSession(r.Context(), id, authdomain.SystemUserID, strings.TrimSpace(body.SessionID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, pi)
}

func (h *Handler) stripeWebhook(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		response.Error(w, paydomain.ErrInvalidInput)
		return
	}
	sig := r.Header.Get("Stripe-Signature")
	if sig == "" && os.Getenv("STRIPE_WEBHOOK_SECRET") == "" {
		response.Error(w, paydomain.ErrInvalidInput)
		return
	}
	if err := h.svc.HandleStripeWebhook(r.Context(), payload, sig, authdomain.SystemUserID); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}
