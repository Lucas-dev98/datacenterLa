import type { RMACase } from "@/lib/api/rma";

export function defaultRmaResolution(c: RMACase): string {
  return c.defect_confirmed ? "scrap" : "restock";
}

export function rmaResolutionOptions(c: RMACase): { value: string; label: string }[] {
  if (c.defect_confirmed) {
    return [
      { value: "scrap", label: "Descarte" },
      { value: "warranty", label: "Garantia fabricante" },
      { value: "refund", label: "Reembolso" },
    ];
  }
  return [
    { value: "restock", label: "Restock" },
    { value: "refund", label: "Reembolso" },
    { value: "warranty", label: "Garantia fabricante" },
  ];
}
