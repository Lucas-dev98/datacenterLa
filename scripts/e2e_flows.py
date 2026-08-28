#!/usr/bin/env python3
"""Deep E2E flow tests via API."""
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://localhost:8082"
WH = "11111111-1111-1111-1111-111111111001"
LOC = "22222222-2222-2222-2222-222222222001"

failures = []


def req(method, path, token=None, body=None, expect=(200, 201)):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw = resp.read()
            code = resp.status
            payload = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"_raw": raw.decode(errors="replace")[:300]}
        if code not in expect:
            failures.append((f"{method} {path} -> {code}", payload))
        return code, payload
    if code not in expect:
        failures.append((f"{method} {path} -> {code}", payload))
    return code, payload


def login():
    _, data = req("POST", "/api/v1/auth/login", body={
        "email": "admin@datacenterla.local",
        "password": "Admin@12345678",
    })
    token = data.get("access_token")
    if not token:
        print("LOGIN FAILED", data)
        sys.exit(1)
    return token


def main():
    token = login()
    print("✓ login")

    # Customers list + create
    _, customers = req("GET", "/api/v1/sales/customers?limit=5", token=token)
    print(f"✓ customers ({customers.get('total', len(customers.get('items', [])))})")

    # Quotes flow
    _, cust_list = req("GET", "/api/v1/sales/customers?limit=1", token=token)
    customer_id = cust_list["items"][0]["id"] if cust_list.get("items") else None
    _, me = req("GET", "/api/v1/auth/me", token=token)
    seller_id = me["id"]

    _, skus = req("GET", "/api/v1/pim/skus?q=000001&limit=1", token=token)
    sku = skus["items"][0] if skus.get("items") else None
    if customer_id and sku:
        _, quote = req("POST", "/api/v1/sales/quotes", token=token, body={
            "customer_id": customer_id,
            "seller_id": seller_id,
            "channel": "erp",
            "items": [{"sku_id": sku["id"], "quantity": 1}],
        }, expect=(200, 201))
        qid = quote.get("id")
        if qid:
            req("POST", f"/api/v1/sales/quotes/{qid}/send", token=token, body={})
            print(f"✓ quote created+sent {quote.get('quote_number', qid[:8])}")

    # Orders list + detail
    _, orders = req("GET", "/api/v1/sales/orders?limit=5", token=token)
    if orders.get("items"):
        oid = orders["items"][0]["id"]
        req("GET", f"/api/v1/sales/orders/{oid}", token=token)
        print(f"✓ order detail {orders['items'][0].get('order_number')}")

    # RMA eligibility on shipped order
    _, shipped = req("GET", "/api/v1/sales/orders?status=shipped&limit=1", token=token)
    if shipped.get("items"):
        o = shipped["items"][0]
        _, order = req("GET", f"/api/v1/sales/orders/{o['id']}", token=token)
        if order.get("items"):
            item_id = order["items"][0]["id"]
            code, elig = req("GET", f"/api/v1/sales/rma/eligibility?order_id={o['id']}&order_item_id={item_id}", token=token, expect=(200, 409))
            print(f"✓ rma eligibility -> {code} units={elig.get('eligible_units')}")

    # Stock health scan
    req("POST", "/api/v1/stock/health/scan", token=token)
    print("✓ health scan")

    # Exchange rates
    req("GET", "/api/v1/pricing/exchange-rates/today", token=token)
    print("✓ exchange rates")

    # Analytics with date range
    _, analytics = req("GET", "/api/v1/sales/analytics/dashboard?from=2026-01-01&to=2026-12-31", token=token)
    if analytics.get("summary", {}).get("orders_count", 0) < 0:
        failures.append(("analytics invalid", analytics))
    print(f"✓ analytics orders={analytics.get('summary',{}).get('orders_count')}")

    # Low stock consistency
    _, dash = req("GET", "/api/v1/sales/dashboard", token=token)
    _, low = req("GET", "/api/v1/stock/low-stock?threshold=2&limit=200", token=token)
    if dash["stats"]["skus_low_stock"] != low["total"]:
        failures.append((f"low_stock mismatch {dash['stats']['skus_low_stock']} vs {low['total']}", {}))
    else:
        print(f"✓ low stock consistent ({low['total']})")

    # Returns list + eligibility
    req("GET", "/api/v1/sales/returns?limit=5", token=token)
    if shipped.get("items") and order.get("items"):
        code, rel = req(
            "GET",
            f"/api/v1/sales/returns/eligibility?order_id={o['id']}&order_item_id={item_id}",
            token=token,
            expect=(200, 409),
        )
        print(f"✓ returns eligibility -> {code} units={rel.get('eligible_units')}")
    else:
        print("✓ returns")

    # Purchases
    req("GET", "/api/v1/purchases/orders?limit=5", token=token)
    print("✓ purchases")

    if failures:
        print(f"\nFAILED {len(failures)}:")
        for label, payload in failures:
            print(f"  ✗ {label}")
            print(f"    {json.dumps(payload, ensure_ascii=False)[:200]}")
        sys.exit(1)
    print("\nAll flow tests passed.")


if __name__ == "__main__":
    main()
