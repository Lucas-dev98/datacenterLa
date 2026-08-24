export type ApiError = { code: string; message: string };

export type CatalogProduct = {
  sku_id: string;
  sku_code: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  price_usd: number;
  price_with_iva_usd: number;
  price_pyg?: number;
  price_with_iva_pyg?: number;
  exchange_rate_usd_pyg?: number;
  image_url?: string;
  available: number;
};

export type EcommerceCategory = {
  id: string;
  code: string;
  name: string;
  parent_id?: string | null;
};

export type PublicOrderItem = {
  sku_code: string;
  sku_name?: string;
  quantity: number;
  unit_price_usd: number;
  line_total_usd: number;
};

export type PublicOrder = {
  id: string;
  order_number: string;
  status: string;
  status_label?: string;
  total_usd: number;
  customer_name: string;
  items?: PublicOrderItem[];
  created_at: string;
};

export type CartItem = {
  sku_id: string;
  sku_code?: string;
  name?: string;
  quantity: number;
  price_usd?: number;
};

export type Cart = {
  id: string;
  session_id: string;
  items: CartItem[];
  expires_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  status: string;
  total_usd: number;
};
