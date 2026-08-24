package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/shopauth/domain"
	"github.com/datacenterla/platform/internal/shopauth/service"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/request-code", h.requestCode)
	r.Post("/verify-code", h.verifyCode)
	return r
}

func (h *Handler) requestCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	err := h.svc.RequestCode(r.Context(), body.Email)
	if errors.Is(err, domain.ErrTooManyRequests) || errors.Is(err, domain.ErrCooldown) {
		response.Error(w, err)
		return
	}
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Se este e-mail tiver pedidos, enviamos um código de acesso.",
	})
}

func (h *Handler) verifyCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	tokens, err := h.svc.VerifyCode(r.Context(), body.Email, body.Code)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, tokens)
}
