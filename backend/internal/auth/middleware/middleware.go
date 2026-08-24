package middleware

import (
	"context"
	"net/http"
	"strings"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	"github.com/datacenterla/platform/internal/auth/jwt"
	"github.com/datacenterla/platform/internal/platform/http/response"
)

type ctxKey int

const userCtxKey ctxKey = 1

type UserContext struct {
	UserID      string
	Email       string
	Permissions map[string]bool
}

func Authenticate(jwtMgr *jwt.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			if token == "" {
				response.Error(w, authdomain.ErrUnauthorized)
				return
			}
			claims, err := jwtMgr.ParseAccess(token)
			if err != nil {
				response.Error(w, authdomain.ErrUnauthorized)
				return
			}
			perms := make(map[string]bool, len(claims.Permissions))
			for _, p := range claims.Permissions {
				perms[p] = true
			}
			uc := UserContext{
				UserID:      claims.UserID.String(),
				Email:       claims.Email,
				Permissions: perms,
			}
			ctx := context.WithValue(r.Context(), userCtxKey, uc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequirePermission(perm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uc, ok := UserFromContext(r.Context())
			if !ok || !uc.Permissions[perm] {
				response.Error(w, authdomain.ErrForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func UserFromContext(ctx context.Context) (UserContext, bool) {
	uc, ok := ctx.Value(userCtxKey).(UserContext)
	return uc, ok
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	}
	return ""
}
