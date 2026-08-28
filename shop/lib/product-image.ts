import { API_URL } from "@/lib/config";

/** Resolve SKU image_url from the API. No product-name mapping on the client. */
export function catalogImageUrl(imageUrl?: string | null): string {
  const raw = imageUrl?.trim();
  if (!raw) {
    return `${API_URL}/static/products/placeholder.svg`;
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) {
    return raw;
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_URL}${path}`;
}
