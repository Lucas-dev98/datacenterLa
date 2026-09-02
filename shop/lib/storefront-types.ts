import type { CatalogProduct } from "./types";

export type StorefrontTrustItem = { icon: string; title: string };
export type StorefrontTextItem = { title: string; text: string };
export type StorefrontFAQItem = { q: string; a: string };

export type StorefrontContent = {
  trust: StorefrontTrustItem[];
  pillars: StorefrontTextItem[];
  steps: StorefrontTextItem[];
  faqs: StorefrontFAQItem[];
};

export type PlatformDefaults = {
  warehouse_id: string;
  location_id: string;
  category_id: string;
};

export type StorefrontPage = {
  defaults: PlatformDefaults;
  featured_models: CatalogProduct[];
  featured: CatalogProduct[];
  parts: Record<string, CatalogProduct>;
  content: StorefrontContent;
};
