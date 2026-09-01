#!/usr/bin/env python3
"""Deep E2E flow tests via API."""
import io
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://localhost:8082"
WH = "11111111-1111-1111-1111-111111111001"
LOC = "22222222-2222-2222-2222-222222222001"
MINI_JPG = bytes([0xFF, 0xD8, 0xFF, 0xD9])

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


def req_multipart(method, path, token, fields, files, expect=(200, 201)):
    boundary = f"----E2EBoundary{uuid.uuid4().hex}"
    body = io.BytesIO()
    for name, value in fields.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        if isinstance(value, str):
            body.write(value.encode())
        else:
            body.write(value)
        body.write(b"\r\n")
    for name, (filename, content, content_type) in files.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode())
        body.write(content)
        body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    url = BASE + path
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}",
    }
    r = urllib.request.Request(url, data=body.getvalue(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
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


def find_po_with_pending(token):
    for status in ("ordered", "partial"):
        _, listed = req("GET", f"/api/v1/purchases/orders?status={status}", token=token)
        for summary in listed.get("items", []):
            _, po = req("GET", f"/api/v1/purchases/orders/{summary['id']}", token=token)
            for item in po.get("items", []):
                pending = item.get("quantity_ordered", 0) - item.get("quantity_received", 0)
                if pending > 0:
                    return po, item, pending
    return None, None, 0


def test_po_receive_intake(token):
    po, item, pending = find_po_with_pending(token)
    if not po or not item:
        print("⊘ po receive-intake (no pending PO line)")
        return

    payload = json.dumps({"items": [{"sku_id": item["sku_id"], "quantity": 1}]})
    code, result = req_multipart(
        "POST",
        f"/api/v1/purchases/orders/{po['id']}/receive-intake",
        token=token,
        fields={"payload": payload},
        files={"batch_photo_0": ("batch.jpg", MINI_JPG, "image/jpeg")},
        expect=(200, 201),
    )
    units = result.get("units") or []
    order = result.get("order") or {}
    print(
        f"✓ po receive-intake po={order.get('po_number', po.get('po_number', po['id'][:8]))} "
        f"units={len(units)} status={order.get('status', '?')} pending_was={pending}"
    )


def test_customer_return_create(token):
    _, shipped = req("GET", "/api/v1/sales/orders?status=shipped&limit=20", token=token)
    for summary in shipped.get("items", []):
        _, order = req("GET", f"/api/v1/sales/orders/{summary['id']}", token=token)
        if not order.get("items"):
            continue
        line = order["items"][0]
        _, window = req("GET", f"/api/v1/sales/returns/window-check?order_id={order['id']}", token=token)
        if not window.get("within_return_window"):
            continue
        _, elig = req(
            "GET",
            f"/api/v1/sales/returns/eligibility?order_id={order['id']}&order_item_id={line['id']}",
            token=token,
            expect=(200, 409),
        )
        if elig.get("eligible_units", 0) < 1:
            continue

        payload = json.dumps({
            "order_id": order["id"],
            "reason": "E2E automated return flow",
            "items": [{"sku_id": line["sku_id"], "quantity": 1}],
        })
        _, ret = req_multipart(
            "POST",
            "/api/v1/sales/returns",
            token=token,
            fields={"payload": payload},
            files={"photo_0": ("return.jpg", MINI_JPG, "image/jpeg")},
            expect=(200, 201),
        )
        print(f"✓ customer return created {ret.get('return_number', ret.get('id', '')[:8])}")
        return

    print("⊘ customer return (no eligible shipped order in window)")


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

    # PO → receive-intake
    test_po_receive_intake(token)

    # RMA eligibility on shipped order
    _, shipped = req("GET", "/api/v1/sales/orders?status=shipped&limit=1", token=token)
    order = {}
    item_id = None
    o = None
    if shipped.get("items"):
        o = shipped["items"][0]
        _, order = req("GET", f"/api/v1/sales/orders/{o['id']}", token=token)
        if order.get("items"):
            item_id = order["items"][0]["id"]
            code, elig = req(
                "GET",
                f"/api/v1/sales/rma/eligibility?order_id={o['id']}&order_item_id={item_id}",
                token=token,
                expect=(200, 409),
            )
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

    # Returns list + eligibility + create
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
        print("✓ returns list")

    test_customer_return_create(token)

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
