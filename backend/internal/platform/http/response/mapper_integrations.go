package response

import (
	"errors"
	"net/http"

	cpdomain "github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
)

func init() {
	Register(mapIntegrationsError)
}

func mapIntegrationsError(err error) (int, ErrorBody, bool) {
	if errors.Is(err, cpdomain.ErrNotFound) {
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}, true
	}
	return 0, ErrorBody{}, false
}
