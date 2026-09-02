#!/usr/bin/env bash
# Regenerate demo_transactional.sql from the current database after catalog edits.
# Requires: DATABASE_URL, psql, pg_dump.
set -euo pipefail

cd "$(dirname "$0")/.."
: "${DATABASE_URL:?set DATABASE_URL}"

OUT="internal/db/seeds/demo_transactional.sql"

pg_dump "$DATABASE_URL" \
  --data-only --no-owner --no-privileges --disable-triggers \
  -t locations -t products -t skus -t sku_prices -t product_attribute_values \
  -t customers -t suppliers -t purchase_orders -t purchase_order_items -t accounts_payable \
  -t stock_intake_batches -t inventory_units -t stock_balances -t stock_movements -t stock_reservations \
  -t quotes -t quote_items -t orders -t order_items \
  -t payments -t payment_intents -t accounts_receivable -t order_ship_photos \
  -t rma_cases -t rma_items -t rma_test_photos \
  -t customer_returns -t customer_return_items -t customer_return_photos \
  -t crm_leads -t stock_counts -t stock_count_lines \
  -t feed_sync_logs -t feed_sync_log_entries -t feed_cache \
  -f "$OUT"

python3 - "$OUT" << 'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
lines = p.read_text().splitlines(keepends=True)
out = []
for line in lines:
    if line.startswith("\\restrict") or line.startswith("\\unrestrict"):
        continue
    if line.startswith("SET transaction_timeout"):
        continue
    if line.startswith("SET SESSION AUTHORIZATION"):
        continue
    if line.startswith("77777777-7777-7777-7777-777777777001\tEXPORT-CN") or \
       line.startswith("77777777-7777-7777-7777-777777777002\tEXPORT-US"):
        continue
    out.append(line)
p.write_text("".join(out))
print(f"wrote {p} ({len(out)} lines)")
PY
