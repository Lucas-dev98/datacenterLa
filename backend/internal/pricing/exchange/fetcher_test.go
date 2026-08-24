package exchange

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetcherFetchUSD(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{
			"result":"success",
			"base_code":"USD",
			"time_last_update_unix": 1787529751,
			"time_last_update_utc":"Mon, 24 Aug 2026 00:02:31 +0000",
			"rates":{"PYG":6008.86,"BRL":5.17,"ARS":1497.45}
		}`))
	}))
	defer srv.Close()

	f := NewFetcher(srv.URL)
	snap, err := f.FetchUSD(context.Background(), []string{"PYG", "BRL", "ARS"})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if snap.Rates["PYG"] != 6008.86 {
		t.Fatalf("pyg: %v", snap.Rates["PYG"])
	}
	if snap.Rates["BRL"] != 5.17 {
		t.Fatalf("brl: %v", snap.Rates["BRL"])
	}
}
