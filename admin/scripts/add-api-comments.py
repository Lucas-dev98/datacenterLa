#!/usr/bin/env python3
"""Insere cabeçalhos JSDoc nos módulos lib/api do admin."""
from __future__ import annotations

import re
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1] / "lib" / "api"
CORE_API = Path(__file__).resolve().parents[1] / "lib" / "api.ts"

META: dict[str, tuple[str, str]] = {
    "client.ts": (
        "Re-exporta o cliente HTTP core e helpers de browser.",
        "Import preferido: `@/lib/api/client`",
    ),
    "index.ts": (
        "Barrel export — reexporta todos os domínios da API admin.",
        "Import: `@/lib/api`",
    ),
    "auth.ts": ("/api/v1/auth — usuários, roles, MFA.", "hooks: use-auth-mutations, useUsersAdmin"),
    "sales.ts": ("/api/v1/sales — pedidos, cotações, clientes, leads, dashboard.", "hooks: use-sales-*, use-quotes-*, use-leads-*"),
    "pos.ts": ("/api/v1/sales/pos — PDV balcão, PIX, comprovante.", "hooks: use-pdv-bootstrap, use-pos-mutations"),
    "stock.ts": ("/api/v1/stock — saldos, intake, inventário, saúde.", "hooks: use-stock-*, use-intake-*"),
    "purchases.ts": ("/api/v1/purchases — fornecedores e POs.", "hooks: use-purchase-*"),
    "pim.ts": ("/api/v1/pim — produtos, SKUs, categorias.", "hooks: use-pim-*, use-product-detail"),
    "pricing.ts": ("/api/v1/pricing — preços USD e câmbio.", "hooks: use-pricing-mutations, use-sku-pricing-detail"),
    "finance.ts": ("/api/v1/sales/finance — recebíveis, pagáveis, margens.", "hooks: use-finance-*"),
    "payments.ts": ("/api/v1/payments — PaymentIntent Stripe.", "hooks: use-payment-mutations"),
    "returns.ts": ("/api/v1/sales/returns — devoluções comerciais.", "hooks: use-customer-returns-*, use-return-step"),
    "rma.ts": ("/api/v1/sales/rma — garantia técnica.", "hooks: use-rma-*"),
    "integrations.ts": ("/api/v1/integrations/compras-paraguai — feed XML.", "hooks: use-compras-paraguai-*"),
    "labels.ts": ("/api/v1/labels — etiquetas de gaveta PDF/HTML.", "hooks: use-label-mutations"),
}


def build_header(filename: str, desc: str, hooks: str) -> str:
    return (
        f"/**\n"
        f" * @file {filename}\n"
        f" * @description {desc}\n"
        f" * @hooks {hooks}\n"
        f" *\n"
        f" * @see admin/lib/api/README.md\n"
        f" */\n\n"
    )


def strip_header(content: str) -> str:
    return re.sub(r"^/\*\*.*?\*/\n\n", "", content, count=1, flags=re.DOTALL)


def main() -> None:
    updated = 0
    for path in sorted(API_DIR.glob("*.ts")):
        meta = META.get(path.name)
        if not meta:
            continue
        desc, hooks = meta
        header = build_header(path.name, desc, hooks)
        content = path.read_text(encoding="utf-8")
        body = strip_header(content)
        new_content = header + body
        if new_content != content:
            path.write_text(new_content, encoding="utf-8")
            updated += 1

    core_header = (
        "/**\n"
        " * Cliente HTTP do admin Next.js.\n"
        " *\n"
        " * - `authFetch`: injeta JWT e renova com refresh token em 401.\n"
        " * - `api` / `apiBlob` / `apiForm` / `apiText`: helpers tipados.\n"
        " * - Domínios ficam em `lib/api/*.ts`; páginas usam hooks, não este arquivo direto.\n"
        " *\n"
        " * @see admin/lib/api/README.md\n"
        " */\n\n"
    )
    core_content = CORE_API.read_text(encoding="utf-8")
    core_body = strip_header(core_content)
    new_core = core_header + core_body
    if new_core != core_content:
        CORE_API.write_text(new_core, encoding="utf-8")
        updated += 1

    print(f"updated {updated} api files")


if __name__ == "__main__":
    main()
