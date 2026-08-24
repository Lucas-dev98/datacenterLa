package domain

import "errors"

var (
	ErrInvalidInput    = errors.New("invalid input")
	ErrUnauthorized    = errors.New("unauthorized")
	ErrInvalidCode     = errors.New("invalid or expired code")
	ErrTooManyRequests = errors.New("too many requests")
	ErrCooldown        = errors.New("cooldown active")
	ErrNoOrders        = errors.New("no orders for this email")
)
