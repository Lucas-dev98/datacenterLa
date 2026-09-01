# CI

Workflows run on push to `main` / `master` and on pull requests.

## Jobs

| Job | Depends on | Purpose |
|-----|------------|---------|
| `backend` | — | Postgres + seed + `go test -tags=integration` |
| `frontend` | — | Admin + shop typecheck and production build |
| `e2e-smoke` | `backend` | API smoke + `scripts/e2e_flows.py` |
| `e2e-ui` | `backend` | Playwright flows + admin route crawl |

## Local parity

```bash
# Backend integration (requires Postgres on :5434)
cd backend && DATABASE_URL=postgres://datacenterla:datacenterla@localhost:5434/datacenterla?sslmode=disable go run ./cmd/seed && go test ./... -tags=integration -count=1

# Admin UI E2E (API :8082, admin :3000)
cd scripts && npm ci && npx playwright install chromium && node run_e2e_ui_flows.mjs
```

## Billing

If GitHub Actions shows **“account is locked due to a billing issue”**, jobs never start — fix billing in GitHub Settings → Billing, then re-run the workflow. Failures with ~1s total duration and all jobs skipped/failed without logs usually indicate this.
