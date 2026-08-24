package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrInvalidState = errors.New("invalid state")
)

type PaymentIntent struct {
	ID           uuid.UUID  `json:"id"`
	OrderID      uuid.UUID  `json:"order_id"`
	AmountUSD    float64    `json:"amount_usd"`
	Currency     string     `json:"currency"`
	Provider     string     `json:"provider"`
	Status       string     `json:"status"`
	ClientSecret string     `json:"client_secret"`
	ProviderRef  *string    `json:"provider_ref,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

type CreateIntentInput struct {
	OrderID   uuid.UUID
	AmountUSD float64
	Provider  string
}
