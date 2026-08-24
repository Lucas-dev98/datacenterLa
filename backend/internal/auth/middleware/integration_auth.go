//go:build integration

package middleware

import (
	"context"
	"net/http"
)

// InjectPermissions adds a user context with the given permission codes (integration tests).
func InjectPermissions(userID string, permissions ...string) func(http.Handler) http.Handler {
	perms := make(map[string]bool, len(permissions))
	for _, p := range permissions {
		perms[p] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uc := UserContext{UserID: userID, Permissions: perms}
			ctx := context.WithValue(r.Context(), userCtxKey, uc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
