package response

import "net/http"

// HTTPMapper maps a domain error to an HTTP status and body. Return ok=false when unhandled.
type HTTPMapper func(err error) (status int, body ErrorBody, ok bool)

var mappers []HTTPMapper

// Register adds an error mapper. Call from init() in domain mapper files.
func Register(mapper HTTPMapper) {
	mappers = append(mappers, mapper)
}

func mapRegistered(err error) (int, ErrorBody, bool) {
	for _, mapper := range mappers {
		if status, body, ok := mapper(err); ok {
			return status, body, true
		}
	}
	return 0, ErrorBody{}, false
}

func notFound(message string) (int, ErrorBody) {
	return http.StatusNotFound, ErrorBody{Code: "NOT_FOUND", Message: message}
}

func badRequest(code, message string) (int, ErrorBody) {
	return http.StatusBadRequest, ErrorBody{Code: code, Message: message}
}

func conflict(code, message string) (int, ErrorBody) {
	return http.StatusConflict, ErrorBody{Code: code, Message: message}
}

func unauthorized(code, message string) (int, ErrorBody) {
	return http.StatusUnauthorized, ErrorBody{Code: code, Message: message}
}
