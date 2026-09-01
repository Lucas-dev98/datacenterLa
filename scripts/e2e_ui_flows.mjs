// Interactive UI flow checks — login required before calling run(page).
const ADMIN_BASE = "http://localhost:3000";
const SKU_CODE = "000001";
const MINI_JPG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

async function runPdvToExpeditionFlow(page, apiErrors) {
  apiErrors.length = 0;
  try {
    await page.goto(`${ADMIN_BASE}/vendas/pdv`, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.getByRole("heading", { name: /PDV/i }).waitFor({ timeout: 10000 });

    await page.getByPlaceholder(/SKU, nome, marca/).fill(SKU_CODE);
    await page.waitForTimeout(400);
    await page.getByRole("button").filter({ hasText: SKU_CODE }).first().click();
    await page.getByText("Carrinho (1)").waitFor({ timeout: 10000 });

    await page.getByRole("checkbox", { name: /Entregar na hora/i }).uncheck();
    await page.getByRole("button", { name: /Gerar QR PIX/i }).click();

    await page.getByRole("heading", { name: "Pagamento PIX" }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();

    await page.getByText("Venda concluída").waitFor({ timeout: 15000 });
    await page.getByText(/pedido na fila de expedição/i).waitFor({ timeout: 5000 });
    const orderNumber = (await page.locator("h2.text-2xl.font-semibold").innerText()).trim();
    if (!orderNumber) {
      return { ok: false, error: "order number not found after PDV sale" };
    }

    await page.goto(`${ADMIN_BASE}/estoque/saida/expedicao`, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.getByRole("heading", { name: /Fila de expedição/i }).waitFor({ timeout: 10000 });

    const row = page.getByRole("row").filter({ hasText: orderNumber });
    await row.waitFor({ timeout: 10000 });
    const rowText = await row.innerText();
    if (!rowText.includes("Loja física") || !rowText.includes("Pago")) {
      return { ok: false, error: `Unexpected expedition row for ${orderNumber}: ${rowText.slice(0, 240)}` };
    }

    await page.getByTestId(`ship-order-${orderNumber}`).click();
    await page.getByTestId("ship-expedition-modal").waitFor({ timeout: 10000 });
    await page.locator('[data-testid="ship-expedition-modal"] input[type="file"]').setInputFiles({
      name: "ship.jpg",
      mimeType: "image/jpeg",
      buffer: MINI_JPG,
    });
    await page.waitForTimeout(300);
    await page.getByTestId("ship-expedition-submit").click();
    await page.getByText("Pedido expedido — estoque baixado").waitFor({ timeout: 15000 });

    const hasServerError = apiErrors.some((e) => e.status >= 500);
    return { ok: !hasServerError, orderNumber, apiErrors: [...apiErrors].slice(0, 3) };
  } catch (err) {
    return { ok: false, error: String(err), apiErrors: [...apiErrors].slice(0, 3) };
  }
}

async function runReturnsApproveReceiveFlow(page, apiErrors) {
  apiErrors.length = 0;
  try {
    await page.goto(`${ADMIN_BASE}/devolucoes`, { waitUntil: "networkidle", timeout: 25000 });
    await page.getByRole("heading", { name: /Devolu/i }).waitFor({ timeout: 10000 });
    const approve = page.getByRole("button", { name: "Aprovar" }).first();
    if ((await approve.count()) === 0) {
      return { ok: true, skipped: "no requested returns" };
    }
    await approve.click();
    await page.getByText(/Devolução: approve/i).waitFor({ timeout: 15000 });
    const receive = page.getByRole("button", { name: "Receber" }).first();
    await receive.waitFor({ timeout: 10000 });
    await receive.click();
    await page.getByText(/Devolução: receive/i).waitFor({ timeout: 15000 });
    const hasServerError = apiErrors.some((e) => e.status >= 500);
    return { ok: !hasServerError, apiErrors: [...apiErrors].slice(0, 3) };
  } catch (err) {
    return { ok: false, error: String(err), apiErrors: [...apiErrors].slice(0, 3) };
  }
}

async function runRmaOpenFlow(page, apiErrors) {
  apiErrors.length = 0;
  try {
    await page.goto(`${ADMIN_BASE}/rma`, { waitUntil: "networkidle", timeout: 25000 });
    await page.getByText("Abrir RMA").waitFor({ timeout: 10000 });
    await page.getByPlaceholder(/PED-001020|Lucas|4567890|AAA0142/).fill("Martín");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.waitForTimeout(800);
    const orderPick = page.locator("ul.max-h-48 button").first();
    await orderPick.waitFor({ timeout: 10000 });
    await orderPick.click();
    await page.waitForTimeout(800);
    await page.getByPlaceholder(/memória não é reconhecida/).fill("E2E — falha intermitente no POST");
    await page.locator("textarea").fill("E2E — teste em bancada confirma defeito reproduzível.");
    await page.locator('form input[type="file"]').first().setInputFiles({
      name: "rma-test.jpg",
      mimeType: "image/jpeg",
      buffer: MINI_JPG,
    });
    await page.getByRole("button", { name: "Abrir caso com teste" }).click();
    await page.getByText(/Caso RMA aberto/i).waitFor({ timeout: 15000 });
    const hasServerError = apiErrors.some((e) => e.status >= 500);
    return { ok: !hasServerError, apiErrors: [...apiErrors].slice(0, 3) };
  } catch (err) {
    return { ok: false, error: String(err), apiErrors: [...apiErrors].slice(0, 3) };
  }
}

async function runIntakeAdvanceFlow(page, apiErrors) {
  apiErrors.length = 0;
  try {
    await page.goto(`${ADMIN_BASE}/estoque/entrada/recebimento`, {
      waitUntil: "networkidle",
      timeout: 25000,
    });
    await page.getByRole("heading", { name: /Fila de recebimento/i }).waitFor({ timeout: 10000 });
    const advanceBtn = page
      .getByRole("button", { name: /Inspecionar|Identificar|Liberar/i })
      .first();
    if ((await advanceBtn.count()) === 0) {
      return { ok: true, skipped: "empty intake queue" };
    }
    await advanceBtn.click();
    await page.getByText(/Unidade AAA/i).waitFor({ timeout: 15000 });
    const hasServerError = apiErrors.some((e) => e.status >= 500);
    return { ok: !hasServerError, apiErrors: [...apiErrors].slice(0, 3) };
  } catch (err) {
    return { ok: false, error: String(err), apiErrors: [...apiErrors].slice(0, 3) };
  }
}

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
      await page.goto(`${ADMIN_BASE}${flow.path}`, {
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

  const pdvFlow = await runPdvToExpeditionFlow(page, apiErrors);
  results.push({
    name: "PDV sale → expedição ship",
    path: "/vendas/pdv → /estoque/saida/expedicao",
    ok: pdvFlow.ok,
    orderNumber: pdvFlow.orderNumber,
    error: pdvFlow.error,
    apiErrors: pdvFlow.apiErrors,
  });

  for (const [name, path, runner] of [
    ["Devolução approve → receive", "/devolucoes", runReturnsApproveReceiveFlow],
    ["RMA open case", "/rma", runRmaOpenFlow],
    ["Intake queue advance", "/estoque/entrada/recebimento", runIntakeAdvanceFlow],
  ]) {
    const flow = await runner(page, apiErrors);
    results.push({ name, path, ok: flow.ok, error: flow.error, skipped: flow.skipped, apiErrors: flow.apiErrors });
  }

  const failed = results.filter((r) => !r.ok);
  return { total: results.length, failed: failed.length, results, failedFlows: failed.map((r) => r.name) };
}
