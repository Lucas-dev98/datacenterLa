// Interactive UI flow checks — login required before calling run(page).
export default async function run(page) {
  const apiErrors = [];
  page.on("response", (resp) => {
    const url = resp.url();
    const status = resp.status();
    if (status >= 400 && url.includes("8082") && !url.includes("favicon")) {
      apiErrors.push({ status, url });
    }
  });

  const flows = [
    {
      name: "Dashboard KPIs",
      path: "/",
      assert: async (p) => {
        await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 10000 });
        return !(await p.locator("body").innerText()).includes("Application error");
      },
    },
    {
      name: "PDV layout",
      path: "/vendas/pdv",
      assert: async (p) => {
        await p.getByRole("heading", { name: /PDV/i }).waitFor({ timeout: 10000 });
        await p.getByText(/Cliente|Consumidor/i).first().waitFor({ timeout: 5000 });
        return true;
      },
    },
    {
      name: "Pedidos list",
      path: "/pedidos",
      assert: async (p) => {
        await p.getByRole("heading", { name: /Pedidos/i }).waitFor({ timeout: 10000 });
        const text = await p.locator("body").innerText();
        return text.includes("Pedido") || text.includes("Nenhum");
      },
    },
    {
      name: "RMA form",
      path: "/rma",
      assert: async (p) => {
        await p.getByRole("heading", { name: /RMA/i }).waitFor({ timeout: 10000 });
        await p.getByText(/Abrir RMA/i).waitFor({ timeout: 5000 });
        return true;
      },
    },
    {
      name: "Devoluções form",
      path: "/devolucoes",
      assert: async (p) => {
        await p.getByRole("heading", { name: /Devolu/i }).waitFor({ timeout: 10000 });
        return true;
      },
    },
    {
      name: "Expedição queue",
      path: "/estoque/saida/expedicao",
      assert: async (p) => {
        await p.getByRole("heading", { name: /Expedi/i }).waitFor({ timeout: 10000 });
        return true;
      },
    },
  ];

  const results = [];
  for (const flow of flows) {
    apiErrors.length = 0;
    try {
      await page.goto(`http://localhost:3000${flow.path}`, {
        waitUntil: "networkidle",
        timeout: 25000,
      });
      await page.waitForTimeout(800);
      const ok = await flow.assert(page);
      const hasServerError = apiErrors.some((e) => e.status >= 500);
      results.push({
        name: flow.name,
        path: flow.path,
        ok: ok && !hasServerError,
        apiErrors: [...apiErrors].slice(0, 3),
      });
    } catch (err) {
      results.push({ name: flow.name, path: flow.path, ok: false, error: String(err) });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return { total: results.length, failed: failed.length, results, failedFlows: failed.map((r) => r.name) };
}
