/** Tipos de documento fiscal paraguaio no PDV. */
export type ParaguayanBuyerKind = "pf_ci" | "pf_ruc" | "pj_ruc";

export type ParaguayanDocumentType = "ci_py" | "ruc_pf" | "ruc_pj";

export const PARAGUAY_BUYER_KINDS: {
  value: ParaguayanBuyerKind;
  label: string;
  hint: string;
  documentType: ParaguayanDocumentType;
  nameLabel: string;
  documentLabel: string;
  documentPlaceholder: string;
}[] = [
  {
    value: "pf_ci",
    label: "Pessoa física (C.I.)",
    hint: "Sem RUC — comprovante como consumidor final com número da cédula.",
    documentType: "ci_py",
    nameLabel: "Nome completo",
    documentLabel: "Cédula de Identidad (C.I.)",
    documentPlaceholder: "Ex.: 4.567.890",
  },
  {
    value: "pf_ruc",
    label: "Pessoa física (RUC)",
    hint: "Contribuinte com atividade econômica — informe o RUC pessoal.",
    documentType: "ruc_pf",
    nameLabel: "Nome completo",
    documentLabel: "RUC pessoal",
    documentPlaceholder: "Ex.: 4567890-0",
  },
  {
    value: "pj_ruc",
    label: "Empresa (RUC)",
    hint: "RUC da empresa e razão social exata para crédito de IVA.",
    documentType: "ruc_pj",
    nameLabel: "Razão social",
    documentLabel: "RUC da empresa",
    documentPlaceholder: "Ex.: 80012345-6",
  },
];

export function paraguayanKindFromDocumentType(type?: string): ParaguayanBuyerKind {
  switch (type) {
    case "ruc_pf":
      return "pf_ruc";
    case "ruc_pj":
      return "pj_ruc";
    default:
      return "pf_ci";
  }
}

export function paraguayanKindMeta(kind: ParaguayanBuyerKind) {
  return PARAGUAY_BUYER_KINDS.find((k) => k.value === kind) ?? PARAGUAY_BUYER_KINDS[0];
}

export function paraguayanReceiptCustomerLabel(documentType?: string, name?: string): string {
  switch (documentType) {
    case "ci_py":
      return "Consumidor Final";
    case "ruc_pj":
    case "ruc_pf":
      return name?.trim() || "Cliente";
    default:
      return name?.trim() || "Consumidor Final";
  }
}

export function paraguayanBuyerKindLabel(documentType?: string): string {
  switch (documentType) {
    case "ci_py":
      return "Pessoa física — consumidor final (C.I.)";
    case "ruc_pf":
      return "Pessoa física contribuinte (RUC)";
    case "ruc_pj":
      return "Empresa (RUC)";
    default:
      return "";
  }
}
