package handler

import (
	"net/http"

	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/platform/settings"
)

// Handler exposes public platform configuration stored in app_settings.
type Handler struct {
	settings *settings.Repository
}

func New(settings *settings.Repository) *Handler {
	return &Handler{settings: settings}
}

// Defaults returns warehouse, location and category IDs for admin/shop clients.
func (h *Handler) Defaults(w http.ResponseWriter, r *http.Request) {
	var defs settings.PlatformDefaults
	if err := h.settings.GetJSON(r.Context(), settings.KeyPlatformDefaults, &defs); err != nil {
		defs = settings.DefaultPlatformDefaults()
	}
	response.JSON(w, http.StatusOK, defs)
}
