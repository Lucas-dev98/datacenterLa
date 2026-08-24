package repository

import (
	"context"

	"github.com/datacenterla/platform/internal/auth/domain"
	"github.com/google/uuid"
)

func (r *Postgres) ListUsers(ctx context.Context, limit int) ([]domain.User, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, email, full_name, is_active, mfa_enabled, email_verified, last_login_at, created_at, updated_at
		FROM users ORDER BY created_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.IsActive, &u.MFAEnabled,
			&u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		if err := r.loadRolesAndPerms(ctx, &u); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Postgres) ListRoles(ctx context.Context) ([]domain.Role, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, code, name FROM roles ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Role
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.ID, &role.Code, &role.Name); err != nil {
			return nil, err
		}
		out = append(out, role)
	}
	return out, rows.Err()
}

func (r *Postgres) UpdateUser(ctx context.Context, id uuid.UUID, fullName *string, isActive *bool, roleIDs []uuid.UUID) (*domain.User, error) {
	if fullName != nil {
		if _, err := r.pool.Exec(ctx, `UPDATE users SET full_name = $2, updated_at = now() WHERE id = $1`, id, *fullName); err != nil {
			return nil, err
		}
	}
	if isActive != nil {
		if _, err := r.pool.Exec(ctx, `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1`, id, *isActive); err != nil {
			return nil, err
		}
	}
	if roleIDs != nil {
		if _, err := r.pool.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, id); err != nil {
			return nil, err
		}
		for _, roleID := range roleIDs {
			if _, err := r.pool.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, id, roleID); err != nil {
				return nil, err
			}
		}
	}
	return r.GetUserByID(ctx, id)
}

func (r *Postgres) SetUserPassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
