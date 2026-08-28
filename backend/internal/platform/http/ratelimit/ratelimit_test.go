package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicAPILimitsLogin(t *testing.T) {
	h := PublicAPI(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	ok, limited := 0, 0
	for i := 0; i < 22; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		req.RemoteAddr = "10.1.2.3:4444"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code == http.StatusTooManyRequests {
			limited++
			continue
		}
		ok++
	}
	if ok != 20 || limited != 2 {
		t.Fatalf("got ok=%d limited=%d", ok, limited)
	}
}

func TestPublicAPISkipsWebhookAndERP(t *testing.T) {
	h := PublicAPI(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	for i := 0; i < 25; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/ecommerce/payments/webhook/stripe", nil)
		req.RemoteAddr = "10.1.2.3:1"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("webhook limited at %d: %d", i, rec.Code)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/pim/products", nil)
	req.RemoteAddr = "10.1.2.3:1"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("erp route should skip limiter, got %d", rec.Code)
	}
}
