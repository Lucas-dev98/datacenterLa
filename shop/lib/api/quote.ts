import { api } from "./client";

const BASE = "/api/v1/ecommerce";

export type QuotePayload = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
};

export async function submitQuote(payload: QuotePayload): Promise<void> {
  await api(`${BASE}/quote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const quoteApi = { submitQuote };
