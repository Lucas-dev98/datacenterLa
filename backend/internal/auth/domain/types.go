package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrInvalidInput  = errors.New("invalid input")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrForbidden     = errors.New("forbidden")
	ErrInvalidCreds  = errors.New("invalid credentials")
	ErrMFARequired   = errors.New("mfa required")
	ErrInvalidMFACode = errors.New("invalid mfa code")
)

type User struct {
	ID            uuid.UUID  `json:"id"`
	Email         string     `json:"email"`
	FullName      string     `json:"full_name"`
	IsActive      bool       `json:"is_active"`
	MFAEnabled    bool       `json:"mfa_enabled"`
	EmailVerified bool       `json:"email_verified"`
	LastLoginAt   *time.Time `json:"last_login_at,omitempty"`
	Roles         []Role     `json:"roles,omitempty"`
	Permissions   []string   `json:"permissions,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type Role struct {
	ID   uuid.UUID `json:"id"`
	Code string    `json:"code"`
	Name string    `json:"name"`
}

type TokenPair struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int    `json:"expires_in"`
	MFARequired      bool   `json:"mfa_required,omitempty"`
	MFASetupRequired bool   `json:"mfa_setup_required,omitempty"`
}

type LoginInput struct {
	Email    string
	Password string
	MFACode  string
}

type CreateUserInput struct {
	Email    string
	Password string
	FullName string
	RoleIDs  []uuid.UUID
}

type UpdateUserInput struct {
	FullName *string      `json:"full_name,omitempty"`
	IsActive *bool        `json:"is_active,omitempty"`
	RoleIDs  []uuid.UUID  `json:"role_ids,omitempty"`
	Password *string      `json:"password,omitempty"`
}

type MFASetup struct {
	Secret string `json:"secret"`
	URL    string `json:"url"`
}
