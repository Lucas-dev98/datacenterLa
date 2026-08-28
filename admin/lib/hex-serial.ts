/** Normaliza identificador hexadecimal (0-9, A-F). */
export function normalizeHexSerial(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidHexSerial(value: string): boolean {
  const normalized = normalizeHexSerial(value);
  return /^[0-9A-F]{4,32}$/.test(normalized);
}
