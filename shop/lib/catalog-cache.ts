type Entry<T> = { data: T; at: number };

const store = new Map<string, Entry<unknown>>();
const TTL_MS = 2 * 60 * 1000;

export async function cachedFetch<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.data as T;
  }
  const data = await loader();
  store.set(key, { data, at: Date.now() });
  return data;
}

export function invalidateCatalogCache() {
  for (const key of store.keys()) {
    if (key.startsWith("catalog:") || key === "categories") {
      store.delete(key);
    }
  }
}

export function seedCatalogCache(
  warehouseId: string,
  products: unknown[],
  categories?: unknown[],
) {
  const params = new URLSearchParams({ warehouse_id: warehouseId });
  store.set(`catalog:${params.toString()}`, { data: products, at: Date.now() });
  if (categories) {
    store.set("categories", { data: categories, at: Date.now() });
  }
}
