package domain

import "errors"

var (
	ErrNotFound            = errors.New("not found")
	ErrInsufficientStock   = errors.New("insufficient stock")
	ErrInvalidTransition   = errors.New("invalid status transition")
	ErrVersionConflict     = errors.New("version conflict")
	ErrDuplicateIdempotency = errors.New("duplicate idempotency key")
	ErrInvalidInput        = errors.New("invalid input")
)

type RuleViolation struct {
	Code    string
	Message string
}

func (e *RuleViolation) Error() string {
	return e.Message
}

func NewRuleViolation(code, message string) *RuleViolation {
	return &RuleViolation{Code: code, Message: message}
}
