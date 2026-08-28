/** Rótulos amigáveis para tipos de movimentação de estoque. */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase_in: "Entrada — compra",
  return_in: "Entrada — devolução",
  transfer_in: "Entrada — transferência",
  adjustment_in: "Entrada — ajuste",
  sale_out: "Saída — venda",
  transfer_out: "Saída — transferência",
  supplier_return: "Saída — devolução ao fornecedor",
  damage_out: "Saída — avaria",
  adjustment_out: "Saída — ajuste",
  reserve: "Reserva (pedido)",
  release: "Liberação de reserva",
  status_change: "Mudança de status",
  reversal: "Estorno",
};

export const MOVEMENT_TYPE_OPTIONS = Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] ?? type;
}

export function movementTypeBadgeClass(type: string): string {
  if (type.endsWith("_in") || type === "return_in") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (type.endsWith("_out") || type === "sale_out" || type === "damage_out") {
    return "bg-rose-100 text-rose-800";
  }
  if (type === "reserve") return "bg-amber-100 text-amber-800";
  if (type === "release") return "bg-sky-100 text-sky-800";
  if (type === "status_change") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export const UNIT_STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  inspecting: "Em inspeção",
  identified: "Identificado",
  available: "Disponível",
  reserved: "Reservado",
  picking: "Em separação",
  sold: "Vendido",
  returned: "Devolvido",
  damaged: "Avariado",
  written_off: "Baixado / descartado",
  warranty: "Garantia",
  rma: "Em RMA",
};

export function unitStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return UNIT_STATUS_LABELS[status] ?? status;
}

export function movementReferenceHref(
  referenceType?: string | null,
  referenceId?: string | null,
): string | null {
  if (!referenceType || !referenceId) return null;
  switch (referenceType) {
    case "order":
      return `/pedidos/${referenceId}`;
    case "purchase":
      return `/compras/${referenceId}`;
    case "rma":
      return `/rma`;
    case "return":
      return `/devolucoes`;
    default:
      return null;
  }
}

export function movementReferenceLabel(referenceType?: string | null): string {
  if (!referenceType) return "—";
  switch (referenceType) {
    case "order":
      return "Pedido";
    case "purchase":
      return "Compra";
    case "reservation":
      return "Reserva";
    case "rma":
      return "RMA / garantia";
    case "return":
      return "Devolução";
    default:
      return referenceType;
  }
}
