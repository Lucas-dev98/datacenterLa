#!/usr/bin/env python3
"""E2E smoke test for Data Center LA admin API."""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8082"
EMAIL = "admin@datacenterla.local"
PASSWORD = "Admin@12345678"
WH = "11111111-1111-1111-1111-111111111001"

failures = []
passed = []


def req(method, path, token=None, body=None, expect=(200,)):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            raw = resp.read()
            code = resp.status
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"_raw": raw[:200].decode(errors="replace")}
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"_raw": raw[:200].decode(errors="replace")}
    ok = code in expect
    label = f"{method} {path} -> {code}"
    if ok:
        passed.append(label)
    else:
        failures.append((label, payload))
    return code, payload


def main():
    code, login = req("POST", "/api/v1/auth/login", body={"email": EMAIL, "password": PASSWORD})
    token = login.get("access_token")
    if not token:
        print("LOGIN FAILED", login)
        sys.exit(1)
    print("LOGIN OK")

    endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/sales/dashboard"),
        ("GET", "/api/v1/sales/analytics/dashboard"),
        ("GET", "/api/v1/sales/finance/summary"),
        ("GET", "/api/v1/sales/finance/margins?limit=5"),
        ("GET", "/api/v1/sales/orders?limit=5"),
        ("GET", "/api/v1/sales/quotes?limit=5"),
        ("GET", "/api/v1/sales/customers?limit=5"),
        ("GET", "/api/v1/sales/receivables?limit=5"),
        ("GET", "/api/v1/sales/payables"),
        ("GET", "/api/v1/sales/rma?limit=5"),
        ("GET", "/api/v1/sales/returns?limit=5"),
        ("GET", f"/api/v1/stock/balances?warehouse_id={WH}&limit=5"),
        ("GET", "/api/v1/stock/low-stock?threshold=2&limit=10"),
        ("GET", "/api/v1/stock/health/dashboard"),
        ("GET", f"/api/v1/stock/movements?warehouse_id={WH}&limit=5"),
        ("GET", "/api/v1/pim/products?limit=5"),
        ("GET", "/api/v1/pim/skus?limit=5"),
        ("GET", "/api/v1/purchases/orders?limit=5"),
        ("GET", "/api/v1/sales/leads?limit=5"),
    ]

    for method, path in endpoints:
        req(method, path, token=token)

    # Analytics sanity
    _, dash = req("GET", "/api/v1/sales/dashboard", token=token)
    stats = dash.get("stats", {})
    low_count = stats.get("skus_low_stock", -1)
    _, low = req("GET", "/api/v1/stock/low-stock?threshold=2&limit=200", token=token)
    low_total = low.get("total", -1)
    if low_count != low_total:
        failures.append((f"low_stock mismatch dashboard={low_count} api={low_total}", {}))

    _, analytics = req("GET", "/api/v1/sales/analytics/dashboard", token=token)
    if "summary" not in analytics or "products" not in analytics:
        failures.append(("analytics dashboard missing fields", analytics))

    print(f"\nPASSED: {len(passed)}")
    for p in passed:
        print(f"  ✓ {p}")

    if failures:
        print(f"\nFAILED: {len(failures)}")
        for label, payload in failures:
            print(f"  ✗ {label}")
            if payload:
                print(f"    {json.dumps(payload, ensure_ascii=False)[:300]}")
        sys.exit(1)

    print("\nAll API smoke tests passed.")


if __name__ == "__main__":
    main()
