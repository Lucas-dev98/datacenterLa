// Admin E2E page crawl — login and visit major routes, collect errors.
export default async function run(page, ui) {
  const results = [];
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    const url = resp.url();
    const status = resp.status();
    if (status >= 400 && url.includes("8082") && !url.includes("favicon")) {
      failedRequests.push({ url, status });
    }
  });

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@datacenterla.local");
  await page.fill('input[type="password"]', "Admin@12345678");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/**", { timeout: 15000 });
  await page.waitForTimeout(1500);

  const routes = [
    "/",
    "/produtos",
    "/precos",
    "/cotacoes",
    "/pedidos",
    "/clientes",
    "/financeiro",
    "/financeiro/analytics",
    "/financeiro/cotacoes",
    "/estoque",
    "/estoque/posicao",
    "/estoque/posicao?estoque_baixo=1",
    "/estoque/movimentacoes",
    "/estoque/saida/expedicao",
    "/estoque/saude",
    "/estoque/unidades",
    "/estoque/entrada",
    "/compras",
    "/etiquetas",
    "/categorias",
    "/crm/leads",
    "/usuarios",
    "/rma",
    "/devolucoes",
    "/vendas/pdv",
  ];

  for (const route of routes) {
    consoleErrors.length = 0;
    failedRequests.length = 0;
    try {
      await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(800);
      const title = await page.title();
      const bodyText = await page.locator("body").innerText();
      const hasError = bodyText.includes("Application error") || bodyText.includes("Unhandled Runtime Error");
      results.push({
        route,
        title,
        ok: !hasError && failedRequests.filter((r) => r.status >= 500).length === 0,
        consoleErrors: [...consoleErrors].slice(0, 5),
        failedRequests: [...failedRequests].slice(0, 5),
        snippet: bodyText.slice(0, 120).replace(/\s+/g, " "),
      });
    } catch (err) {
      results.push({ route, ok: false, error: String(err) });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return { total: results.length, failed: failed.length, results, failedRoutes: failed.map((r) => r.route) };
}
