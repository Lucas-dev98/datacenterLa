package response

import (
	"errors"
	"net/http"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
)

func init() {
	Register(mapAuthError)
}

func mapAuthError(err error) (int, ErrorBody, bool) {
	switch {
	case errors.Is(err, authdomain.ErrUnauthorized), errors.Is(err, authdomain.ErrInvalidCreds):
		return http.StatusUnauthorized, ErrorBody{Code: "UNAUTHORIZED", Message: err.Error()}, true
	case errors.Is(err, authdomain.ErrForbidden):
		return http.StatusForbidden, ErrorBody{Code: "FORBIDDEN", Message: err.Error()}, true
	case errors.Is(err, authdomain.ErrMFARequired):
		return http.StatusUnauthorized, ErrorBody{Code: "MFA_REQUIRED", Message: err.Error()}, true
	case errors.Is(err, authdomain.ErrInvalidMFACode):
		return http.StatusUnauthorized, ErrorBody{Code: "INVALID_MFA", Message: err.Error()}, true
	case errors.Is(err, authdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}, true
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}, true
	default:
		return 0, ErrorBody{}, false
	}
}
