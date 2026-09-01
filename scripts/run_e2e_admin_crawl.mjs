#!/usr/bin/env node
/** Run admin route crawl against a running admin + API. */
import { chromium } from "playwright";
import run from "./e2e_admin_crawl.mjs";

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:8082";

async function waitFor(url, label, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok || res.status === 404 || res.status === 405) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} not reachable at ${url}`);
}

async function main() {
  await waitFor(`${API_URL}/api/v1/auth/login`, "API");
  await waitFor(`${ADMIN_URL}/login`, "Admin");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const result = await run(page);
  await browser.close();

  console.log(`Admin crawl: ${result.total - result.failed}/${result.total} routes OK`);
  if (result.failed > 0) {
    for (const route of result.failedRoutes) {
      const row = result.results.find((r) => r.route === route);
      console.error(`  ✗ ${route}`, row?.error ?? row?.failedRequests ?? row?.consoleErrors ?? "");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
