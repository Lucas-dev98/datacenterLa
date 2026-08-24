package handler

import (
	"encoding/json"
	"net/http"

	"github.com/datacenterla/platform/internal/auth/domain"
	"github.com/datacenterla/platform/internal/auth/middleware"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/auth/service"
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
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)
	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(h.svc.JWT()))
		r.Get("/me", h.me)
		r.Post("/mfa/setup", h.setupMFA)
		r.Post("/mfa/enable", h.enableMFA)
		r.With(authmiddleware.RequirePermission("auth.users.manage")).Get("/users", h.listUsers)
		r.With(authmiddleware.RequirePermission("auth.users.manage")).Post("/users", h.createUser)
		r.With(authmiddleware.RequirePermission("auth.users.manage")).Get("/users/{id}", h.getUser)
		r.With(authmiddleware.RequirePermission("auth.users.manage")).Patch("/users/{id}", h.updateUser)
		r.With(authmiddleware.RequirePermission("auth.users.manage")).Get("/roles", h.listRoles)
	})
	return r
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		MFACode  string `json:"mfa_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	tokens, err := h.svc.Login(r.Context(), domain.LoginInput{
		Email: body.Email, Password: body.Password, MFACode: body.MFACode,
	})
	if err != nil {
		if tokens != nil && tokens.MFARequired {
			response.JSON(w, http.StatusUnauthorized, map[string]any{
				"code": "MFA_REQUIRED", "message": err.Error(), "mfa_required": true,
			})
			return
		}
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, tokens)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	tokens, err := h.svc.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, tokens)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	uc, ok := middleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrUnauthorized)
		return
	}
	user, err := h.svc.Me(r.Context(), uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, user)
}

func (h *Handler) setupMFA(w http.ResponseWriter, r *http.Request) {
	uc, _ := middleware.UserFromContext(r.Context())
	setup, err := h.svc.SetupMFA(r.Context(), uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, setup)
}

func (h *Handler) enableMFA(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := middleware.UserFromContext(r.Context())
	if err := h.svc.EnableMFA(r.Context(), uuid.MustParse(uc.UserID), body.Code); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateUserInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	user, err := h.svc.CreateUser(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, user)
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.ListUsers(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": users})
}

func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	user, err := h.svc.Me(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, user)
}

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.UpdateUserInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	user, err := h.svc.UpdateUser(r.Context(), id, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, user)
}

func (h *Handler) listRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.svc.ListRoles(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": roles})
}
