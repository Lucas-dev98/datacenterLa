/** Rótulos em português para status de entidades no admin. */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  confirmed: "Confirmado",
  paid: "Pago",
  picking: "Separação",
  shipped: "Expedido",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export function orderStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return ORDER_STATUS_LABELS[status] ?? status;
}

export const ORDER_EXPEDITION_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado — aguardando separação",
  paid: "Pago — aguardando separação",
  picking: "Em separação",
};

export function orderExpeditionStatusLabel(status: string): string {
  return ORDER_EXPEDITION_STATUS_LABELS[status] ?? orderStatusLabel(status);
}

export const PURCHASE_RECEIVE_STATUS_LABELS: Record<string, string> = {
  ordered: "Aguardando recebimento",
  partial: "Recebimento parcial",
};

export function purchaseReceiveStatusLabel(status: string): string {
  return PURCHASE_RECEIVE_STATUS_LABELS[status] ?? status;
}

export const SUPPLIER_RETURN_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  sent: "Enviada ao fornecedor",
  closed: "Encerrada",
  cancelled: "Cancelada",
};

export function supplierReturnStatusLabel(status: string): string {
  return SUPPLIER_RETURN_STATUS_LABELS[status] ?? status;
}

export const CUSTOMER_RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Solicitada",
  approved: "Aprovada — aguardando recebimento",
  received: "Recebida — aguardando resolução",
  resolved: "Resolvida",
};

export function customerReturnStatusLabel(status: string): string {
  return CUSTOMER_RETURN_STATUS_LABELS[status] ?? status;
}

export const RMA_STATUS_LABELS: Record<string, string> = {
  inspecting: "Em teste / aguardando aprovação",
  approved: "Aprovado — aguardando recebimento",
  received: "Recebido — aguardando resolução",
  resolved: "Resolvido",
};

export function rmaStatusLabel(status: string): string {
  return RMA_STATUS_LABELS[status] ?? status;
}

export const INTAKE_STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  inspecting: "Em inspeção",
  identified: "Identificado",
};

export function intakeStatusLabel(status: string): string {
  return INTAKE_STATUS_LABELS[status] ?? status;
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  viewed: "Visualizada",
  negotiating: "Em negociação",
  approved: "Aprovada",
  rejected: "Rejeitada",
  expired: "Expirada",
  converted: "Convertida em pedido",
};

export function quoteStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return QUOTE_STATUS_LABELS[status] ?? status;
}

export const FINANCE_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Quitado",
  cancelled: "Cancelado",
};

export function financeAccountStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return FINANCE_ACCOUNT_STATUS_LABELS[status] ?? status;
}

export { UNIT_STATUS_LABELS, unitStatusLabel } from "./stock-movements";

export const UNIT_STATUS_BADGE: Record<string, string> = {
  received: "bg-amber-100 text-amber-900",
  inspecting: "bg-amber-100 text-amber-900",
  identified: "bg-sky-100 text-sky-900",
  available: "bg-emerald-100 text-emerald-900",
  reserved: "bg-violet-100 text-violet-900",
  picking: "bg-violet-100 text-violet-900",
  sold: "bg-slate-200 text-slate-800",
  returned: "bg-orange-100 text-orange-900",
  damaged: "bg-red-100 text-red-900",
  written_off: "bg-slate-200 text-slate-800",
  warranty: "bg-amber-100 text-amber-900",
  rma: "bg-orange-100 text-orange-900",
};
