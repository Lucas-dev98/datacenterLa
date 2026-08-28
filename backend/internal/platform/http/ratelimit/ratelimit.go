package ratelimit

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/datacenterla/platform/internal/platform/http/response"
)

// PublicAPI limits unauthenticated storefront, auth login and partner feed
// traffic. ERP routes and payment webhooks are not counted so the admin panel
// stays usable during a shop traffic spike.
func PublicAPI(next http.Handler) http.Handler {
	store := newWindowStore()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit, window, ok := publicBudget(r)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		key := clientIP(r) + "|" + budgetKey(r)
		if !store.allow(key, limit, window) {
			w.Header().Set("Retry-After", "60")
			response.JSON(w, http.StatusTooManyRequests, response.ErrorBody{
				Code:    "RATE_LIMITED",
				Message: "too many requests",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func publicBudget(r *http.Request) (int, time.Duration, bool) {
	p := r.URL.Path
	if strings.Contains(p, "/webhook/") {
		return 0, 0, false
	}
	switch {
	case p == "/api/v1/auth/login" || p == "/api/v1/auth/refresh":
		return 20, time.Minute, true
	case strings.HasPrefix(p, "/api/v1/ecommerce") || strings.HasPrefix(p, "/api/v1/integrations/compras-paraguai"):
		return 300, time.Minute, true
	default:
		return 0, 0, false
	}
}

func budgetKey(r *http.Request) string {
	p := r.URL.Path
	if p == "/api/v1/auth/login" || p == "/api/v1/auth/refresh" {
		return "auth"
	}
	return "public"
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type windowStore struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	n     int
	reset time.Time
}

func newWindowStore() *windowStore {
	return &windowStore{buckets: map[string]*bucket{}}
}

func (s *windowStore) allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.buckets[key]
	if b == nil || now.After(b.reset) {
		s.buckets[key] = &bucket{n: 1, reset: now.Add(window)}
		if len(s.buckets) > 10_000 {
			s.gcLocked(now)
		}
		return true
	}
	if b.n >= limit {
		return false
	}
	b.n++
	return true
}

func (s *windowStore) gcLocked(now time.Time) {
	for k, b := range s.buckets {
		if now.After(b.reset) {
			delete(s.buckets, k)
		}
	}
}
