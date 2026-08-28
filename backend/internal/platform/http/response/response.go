package response

import (
	"encoding/json"
	"errors"
	"net/http"

	pimdomain "github.com/datacenterla/platform/internal/pim/domain"
	pricingdomain "github.com/datacenterla/platform/internal/pricing/domain"
	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	cpdomain "github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
	purchdomain "github.com/datacenterla/platform/internal/purchases/domain"
	salesdomain "github.com/datacenterla/platform/internal/sales/domain"
	shopdomain "github.com/datacenterla/platform/internal/shopauth/domain"
	"github.com/datacenterla/platform/internal/stock/domain"
)

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func Error(w http.ResponseWriter, err error) {
	status, body := mapError(err)
	JSON(w, status, body)
}

func mapError(err error) (int, ErrorBody) {
	var rv *domain.RuleViolation
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, domain.ErrInsufficientStock):
		return http.StatusConflict, ErrorBody{Code: "INSUFFICIENT_STOCK", Message: err.Error()}
	case errors.Is(err, domain.ErrInvalidTransition), errors.As(err, &rv):
		if rv != nil {
			return http.StatusUnprocessableEntity, ErrorBody{Code: rv.Code, Message: rv.Message}
		}
		return http.StatusUnprocessableEntity, ErrorBody{Code: "INVALID_TRANSITION", Message: err.Error()}
	case errors.Is(err, domain.ErrVersionConflict):
		return http.StatusConflict, ErrorBody{Code: "VERSION_CONFLICT", Message: err.Error()}
	case errors.Is(err, domain.ErrInvalidInput), errors.Is(err, pimdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}
	case errors.Is(err, pimdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, pricingdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "PRICE_NOT_FOUND", Message: "Preço não cadastrado para este SKU — configure em Preços"}
	case errors.Is(err, pimdomain.ErrDuplicate):
		return http.StatusConflict, ErrorBody{Code: "DUPLICATE", Message: err.Error()}
	case errors.Is(err, pimdomain.ErrHasDependents):
		return http.StatusConflict, ErrorBody{Code: "HAS_DEPENDENTS", Message: err.Error()}
	case errors.Is(err, pimdomain.ErrConflict):
		return http.StatusConflict, ErrorBody{Code: "CONFLICT", Message: err.Error()}
	case errors.Is(err, authdomain.ErrUnauthorized), errors.Is(err, authdomain.ErrInvalidCreds):
		return http.StatusUnauthorized, ErrorBody{Code: "UNAUTHORIZED", Message: err.Error()}
	case errors.Is(err, authdomain.ErrForbidden):
		return http.StatusForbidden, ErrorBody{Code: "FORBIDDEN", Message: err.Error()}
	case errors.Is(err, authdomain.ErrMFARequired):
		return http.StatusUnauthorized, ErrorBody{Code: "MFA_REQUIRED", Message: err.Error()}
	case errors.Is(err, authdomain.ErrInvalidMFACode):
		return http.StatusUnauthorized, ErrorBody{Code: "INVALID_MFA", Message: err.Error()}
	case errors.Is(err, authdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, authdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrInvalidState):
		return http.StatusConflict, ErrorBody{Code: "INVALID_STATE", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrWarrantyExpired):
		return http.StatusConflict, ErrorBody{Code: "WARRANTY_EXPIRED", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrReturnWindowExpired):
		return http.StatusConflict, ErrorBody{Code: "RETURN_WINDOW_EXPIRED", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrNoEligibleUnits):
		return http.StatusConflict, ErrorBody{Code: "NO_ELIGIBLE_UNITS", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrInsufficientCredit):
		return http.StatusConflict, ErrorBody{Code: "INSUFFICIENT_CREDIT", Message: err.Error()}
	case errors.Is(err, salesdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}
	case errors.Is(err, pricingdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_PRICE", Message: "Preço inválido ou canal sem valor configurado para este SKU"}
	case errors.Is(err, salesdomain.ErrEmptyCart):
		return http.StatusBadRequest, ErrorBody{Code: "EMPTY_CART", Message: err.Error()}
	case errors.Is(err, shopdomain.ErrUnauthorized):
		return http.StatusUnauthorized, ErrorBody{Code: "UNAUTHORIZED", Message: err.Error()}
	case errors.Is(err, shopdomain.ErrInvalidCode):
		return http.StatusUnauthorized, ErrorBody{Code: "INVALID_CODE", Message: "Código inválido ou expirado"}
	case errors.Is(err, shopdomain.ErrTooManyRequests):
		return http.StatusTooManyRequests, ErrorBody{Code: "TOO_MANY_REQUESTS", Message: "Muitas tentativas. Tente novamente em alguns minutos."}
	case errors.Is(err, shopdomain.ErrCooldown):
		return http.StatusTooManyRequests, ErrorBody{Code: "COOLDOWN", Message: "Aguarde 30 segundos antes de solicitar outro código."}
	case errors.Is(err, shopdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}
	case errors.Is(err, cpdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, purchdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}
	case errors.Is(err, purchdomain.ErrInvalidState):
		return http.StatusConflict, ErrorBody{Code: "INVALID_STATE", Message: err.Error()}
	case errors.Is(err, purchdomain.ErrInvalidImport):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_IMPORT", Message: "Exportação exige fornecedor do grupo no país de origem (CN ou US) que exporta para Data Center LA"}
	case errors.Is(err, purchdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}
	default:
		return http.StatusInternalServerError, ErrorBody{Code: "INTERNAL_ERROR", Message: err.Error()}
	}
}
