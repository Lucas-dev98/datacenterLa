#!/usr/bin/env node
/** Login to admin and run interactive UI flow assertions. */
import { chromium } from "playwright";
import runFlows from "./e2e_ui_flows.mjs";
import runCrawl from "./e2e_admin_crawl.mjs";

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:8082";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@datacenterla.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@12345678";

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

async function login(page) {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${ADMIN_URL}/**`, { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function main() {
  await waitFor(`${API_URL}/health/ready`, "API ready");
  await waitFor(`${ADMIN_URL}/login`, "Admin");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await login(page);

  const flows = await runFlows(page);
  console.log(`UI flows: ${flows.total - flows.failed}/${flows.total} passed`);
  if (flows.failed > 0) {
    for (const name of flows.failedFlows) {
      const row = flows.results.find((r) => r.name === name);
      console.error(`  ✗ ${name}`, row?.error ?? row?.apiErrors ?? "");
    }
    await browser.close();
    process.exit(1);
  }

  const crawl = await runCrawl(page);
  console.log(`UI crawl: ${crawl.total - crawl.failed}/${crawl.total} routes OK`);
  if (crawl.failed > 0) {
    for (const route of crawl.failedRoutes) {
      console.error(`  ✗ ${route}`);
    }
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
