export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const DEFAULT_WAREHOUSE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_WAREHOUSE_ID?.trim() ||
  "11111111-1111-1111-1111-111111111001";
