export function customerProfileLabel(c: {
  id: string;
  name: string;
  residency?: string;
  nationality?: string;
  document_id?: string;
  document_type?: string;
}, walkInId?: string, fallback?: string): string {
  if (walkInId && c.id === walkInId) return "Consumidor final";
  if (c.residency === "paraguayan") return "Paraguaio";
  if (c.residency === "foreigner") {
    return c.nationality ? `Estrangeiro (${c.nationality})` : "Estrangeiro";
  }
  return fallback || (c.name ? "Cliente cadastrado" : "Cliente");
}

export function documentTypeLabel(type?: string): string {
  switch (type) {
    case "ci_py":
      return "C.I.";
    case "ruc_pf":
      return "RUC";
    case "ruc_pj":
      return "RUC";
    case "ruc":
      return "RUC";
    case "cpf":
      return "CPF";
    case "rg":
      return "RG";
    case "dni":
      return "DNI";
    case "passport":
      return "Passaporte";
    default:
      return "Doc";
  }
}

export function digitsOnly(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function customerMatchesQuery(
  c: { name: string; document_id?: string; phone?: string },
  q: string,
): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return false;
  const digits = digitsOnly(term);
  const name = c.name.toLowerCase();
  const doc = (c.document_id ?? "").toLowerCase();
  const phone = (c.phone ?? "").toLowerCase();
  if (name.includes(term) || doc.includes(term) || phone.includes(term)) return true;
  return digits.length >= 5 && (digitsOnly(doc).includes(digits) || digitsOnly(phone).includes(digits));
}
