package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/shopauth/domain"
	"github.com/datacenterla/platform/internal/shopauth/jwt"
)

type ctxKey int

const shopCtxKey ctxKey = 1

type ShopContext struct {
	Email string
}

func Authenticate(jwtMgr *jwt.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			if token == "" {
				response.Error(w, domain.ErrUnauthorized)
				return
			}
			claims, err := jwtMgr.Parse(token)
			if err != nil {
				response.Error(w, domain.ErrUnauthorized)
				return
			}
			sc := ShopContext{Email: strings.ToLower(strings.TrimSpace(claims.Email))}
			ctx := context.WithValue(r.Context(), shopCtxKey, sc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ShopFromContext(ctx context.Context) (ShopContext, bool) {
	sc, ok := ctx.Value(shopCtxKey).(ShopContext)
	return sc, ok
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	}
	return ""
}
