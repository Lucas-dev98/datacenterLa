package response

import (
	"encoding/json"
	"net/http"
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
	if status, body, ok := mapRegistered(err); ok {
		return status, body
	}
	return http.StatusInternalServerError, ErrorBody{Code: "INTERNAL_ERROR", Message: err.Error()}
}
