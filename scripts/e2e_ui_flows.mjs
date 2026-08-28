// UI flow QA — run via browser CDP after login cookies exist in tab
export default async function run(page) {
  const routes = [
    { name: "Dashboard", path: "/" },
    { name: "PDV", path: "/vendas/pdv" },
    { name: "Expedição", path: "/estoque/saida/expedicao" },
    { name: "Entrada avulsa", path: "/estoque/entrada/avulsa" },
    { name: "RMA", path: "/rma" },
    { name: "Devoluções", path: "/devolucoes" },
    { name: "Analytics", path: "/financeiro/analytics" },
    { name: "Estoque crítico", path: "/estoque/posicao?estoque_baixo=1" },
    { name: "Cotações", path: "/cotacoes" },
    { name: "Pedidos", path: "/pedidos" },
  ];

  const apiErrors = [];
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.includes("8082")) apiErrors.push({ status: r.status(), url: u });
  });

  const results = [];
  for (const route of routes) {
    apiErrors.length = 0;
    await page.goto(`http://localhost:3000${route.path}`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(1200);
    const text = await page.locator("main, [class*='max-w']").first().innerText().catch(() => page.locator("body").innerText());
    const bad =
      text.includes("Application error") ||
      text.includes("Unhandled Runtime Error") ||
      text.includes("Internal Server Error") ||
      apiErrors.some((e) => e.status >= 500);
    results.push({
      name: route.name,
      path: route.path,
      ok: !bad,
      apiErrors: [...apiErrors].slice(0, 3),
      preview: text.replace(/\s+/g, " ").slice(0, 100),
    });
  }
  return { failed: results.filter((r) => !r.ok), results };
}
