/** Rótulos amigáveis para origem do pedido (campo `channel`). */
export const ORDER_CHANNEL_LABELS: Record<string, string> = {
  ecommerce: "E-commerce",
  store: "Loja física",
  erp: "ERP / B2B",
};

export function orderChannelLabel(channel: string): string {
  return ORDER_CHANNEL_LABELS[channel.toLowerCase()] ?? channel;
}

export function orderChannelBadgeClass(channel: string): string {
  switch (channel.toLowerCase()) {
    case "ecommerce":
      return "bg-violet-100 text-violet-800";
    case "store":
      return "bg-emerald-100 text-emerald-800";
    case "erp":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
