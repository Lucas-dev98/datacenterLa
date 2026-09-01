package response

import (
	"errors"
	"net/http"

	pimdomain "github.com/datacenterla/platform/internal/pim/domain"
	pricingdomain "github.com/datacenterla/platform/internal/pricing/domain"
	purchdomain "github.com/datacenterla/platform/internal/purchases/domain"
	salesdomain "github.com/datacenterla/platform/internal/sales/domain"
	shopdomain "github.com/datacenterla/platform/internal/shopauth/domain"
	"github.com/datacenterla/platform/internal/stock/domain"
)

func init() {
	Register(mapStockError)
	Register(mapPIMError)
	Register(mapSalesError)
	Register(mapPurchasesError)
	Register(mapShopAuthError)
}

func mapStockError(err error) (int, ErrorBody, bool) {
	var rv *domain.RuleViolation
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}, true
	case errors.Is(err, domain.ErrInsufficientStock):
		return http.StatusConflict, ErrorBody{Code: "INSUFFICIENT_STOCK", Message: err.Error()}, true
	case errors.Is(err, domain.ErrInvalidTransition), errors.As(err, &rv):
		if rv != nil {
			return http.StatusUnprocessableEntity, ErrorBody{Code: rv.Code, Message: rv.Message}, true
		}
		return http.StatusUnprocessableEntity, ErrorBody{Code: "INVALID_TRANSITION", Message: err.Error()}, true
	case errors.Is(err, domain.ErrVersionConflict):
		return http.StatusConflict, ErrorBody{Code: "VERSION_CONFLICT", Message: err.Error()}, true
	case errors.Is(err, domain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}, true
	default:
		return 0, ErrorBody{}, false
	}
}

func mapPIMError(err error) (int, ErrorBody, bool) {
	switch {
	case errors.Is(err, pimdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}, true
	case errors.Is(err, pimdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}, true
	case errors.Is(err, pimdomain.ErrDuplicate):
		return http.StatusConflict, ErrorBody{Code: "DUPLICATE", Message: err.Error()}, true
	case errors.Is(err, pimdomain.ErrHasDependents):
		return http.StatusConflict, ErrorBody{Code: "HAS_DEPENDENTS", Message: err.Error()}, true
	case errors.Is(err, pimdomain.ErrConflict):
		return http.StatusConflict, ErrorBody{Code: "CONFLICT", Message: err.Error()}, true
	case errors.Is(err, pricingdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "PRICE_NOT_FOUND", Message: "Preço não cadastrado para este SKU — configure em Preços"}, true
	case errors.Is(err, pricingdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_PRICE", Message: "Preço inválido ou canal sem valor configurado para este SKU"}, true
	default:
		return 0, ErrorBody{}, false
	}
}

func mapSalesError(err error) (int, ErrorBody, bool) {
	switch {
	case errors.Is(err, salesdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrInvalidState):
		return http.StatusConflict, ErrorBody{Code: "INVALID_STATE", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrWarrantyExpired):
		return http.StatusConflict, ErrorBody{Code: "WARRANTY_EXPIRED", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrReturnWindowExpired):
		return http.StatusConflict, ErrorBody{Code: "RETURN_WINDOW_EXPIRED", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrNoEligibleUnits):
		return http.StatusConflict, ErrorBody{Code: "NO_ELIGIBLE_UNITS", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrInsufficientCredit):
		return http.StatusConflict, ErrorBody{Code: "INSUFFICIENT_CREDIT", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}, true
	case errors.Is(err, salesdomain.ErrEmptyCart):
		return http.StatusBadRequest, ErrorBody{Code: "EMPTY_CART", Message: err.Error()}, true
	default:
		return 0, ErrorBody{}, false
	}
}

func mapPurchasesError(err error) (int, ErrorBody, bool) {
	switch {
	case errors.Is(err, purchdomain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: err.Error()}, true
	case errors.Is(err, purchdomain.ErrInvalidState):
		return http.StatusConflict, ErrorBody{Code: "INVALID_STATE", Message: err.Error()}, true
	case errors.Is(err, purchdomain.ErrInvalidImport):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_IMPORT", Message: "Exportação exige fornecedor do grupo no país de origem (CN ou US) que exporta para Data Center LA"}, true
	case errors.Is(err, purchdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}, true
	default:
		return 0, ErrorBody{}, false
	}
}

func mapShopAuthError(err error) (int, ErrorBody, bool) {
	switch {
	case errors.Is(err, shopdomain.ErrUnauthorized):
		return http.StatusUnauthorized, ErrorBody{Code: "UNAUTHORIZED", Message: err.Error()}, true
	case errors.Is(err, shopdomain.ErrInvalidCode):
		return http.StatusUnauthorized, ErrorBody{Code: "INVALID_CODE", Message: "Código inválido ou expirado"}, true
	case errors.Is(err, shopdomain.ErrTooManyRequests):
		return http.StatusTooManyRequests, ErrorBody{Code: "TOO_MANY_REQUESTS", Message: "Muitas tentativas. Tente novamente em alguns minutos."}, true
	case errors.Is(err, shopdomain.ErrCooldown):
		return http.StatusTooManyRequests, ErrorBody{Code: "COOLDOWN", Message: "Aguarde 30 segundos antes de solicitar outro código."}, true
	case errors.Is(err, shopdomain.ErrInvalidInput):
		return http.StatusBadRequest, ErrorBody{Code: "INVALID_INPUT", Message: err.Error()}, true
	default:
		return 0, ErrorBody{}, false
	}
}
