package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/datacenterla/platform/internal/auth/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (r *Postgres) GetUserByEmail(ctx context.Context, email string) (*domain.User, string, error) {
	var u domain.User
	var hash string
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, password_hash, full_name, is_active, mfa_enabled, email_verified,
		       last_login_at, created_at, updated_at
		FROM users WHERE email = $1
	`, email).Scan(&u.ID, &u.Email, &hash, &u.FullName, &u.IsActive, &u.MFAEnabled,
		&u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", domain.ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if err := r.loadRolesAndPerms(ctx, &u); err != nil {
		return nil, "", err
	}
	return &u, hash, nil
}

func (r *Postgres) GetUserByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var u domain.User
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, full_name, is_active, mfa_enabled, email_verified,
		       last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.FullName, &u.IsActive, &u.MFAEnabled,
		&u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := r.loadRolesAndPerms(ctx, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Postgres) GetMFASecret(ctx context.Context, userID uuid.UUID) (string, error) {
	var secret *string
	err := r.pool.QueryRow(ctx, `SELECT mfa_secret FROM users WHERE id = $1`, userID).Scan(&secret)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	if secret == nil {
		return "", domain.ErrInvalidInput
	}
	return *secret, err
}

func (r *Postgres) SaveRefreshToken(ctx context.Context, userID uuid.UUID, rawToken string, expiresAt time.Time) error {
	hash := hashToken(rawToken)
	_, err := r.pool.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)
	`, userID, hash, expiresAt)
	return err
}

func (r *Postgres) FindRefreshToken(ctx context.Context, rawToken string) (uuid.UUID, time.Time, error) {
	hash := hashToken(rawToken)
	var userID uuid.UUID
	var expiresAt time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, expires_at FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, hash).Scan(&userID, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, time.Time{}, domain.ErrUnauthorized
	}
	return userID, expiresAt, err
}

func (r *Postgres) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	hash := hashToken(rawToken)
	_, err := r.pool.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL
	`, hash)
	return err
}

func (r *Postgres) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`, userID)
	return err
}

func (r *Postgres) SetMFASecret(ctx context.Context, userID uuid.UUID, secret string, enabled bool) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET mfa_secret = $2, mfa_enabled = $3, updated_at = now() WHERE id = $1
	`, userID, secret, enabled)
	return err
}

func (r *Postgres) CreateUser(ctx context.Context, email, hash, fullName string, roleIDs []uuid.UUID) (*domain.User, error) {
	var u domain.User
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name, email_verified)
		VALUES ($1, $2, $3, true)
		RETURNING id, email, full_name, is_active, mfa_enabled, email_verified, created_at, updated_at
	`, email, hash, fullName).Scan(&u.ID, &u.Email, &u.FullName, &u.IsActive, &u.MFAEnabled,
		&u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	for _, roleID := range roleIDs {
		if _, err := r.pool.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, u.ID, roleID); err != nil {
			return nil, err
		}
	}
	if err := r.loadRolesAndPerms(ctx, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Postgres) loadRolesAndPerms(ctx context.Context, u *domain.User) error {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.code, r.name FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`, u.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.ID, &role.Code, &role.Name); err != nil {
			return err
		}
		u.Roles = append(u.Roles, role)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	prows, err := r.pool.Query(ctx, `
		SELECT DISTINCT p.code FROM permissions p
		JOIN role_permissions rp ON rp.permission_id = p.id
		JOIN user_roles ur ON ur.role_id = rp.role_id
		WHERE ur.user_id = $1
	`, u.ID)
	if err != nil {
		return err
	}
	defer prows.Close()
	for prows.Next() {
		var code string
		if err := prows.Scan(&code); err != nil {
			return err
		}
		u.Permissions = append(u.Permissions, code)
	}
	return prows.Err()
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
