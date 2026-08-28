export type ApiError = { code: string; message: string };

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  mfa_required?: boolean;
  mfa_setup_required?: boolean;
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  is_active?: boolean;
  mfa_enabled?: boolean;
  roles?: { id: string; code: string; name: string }[] | string[];
  permissions: string[];
};

export type Category = {
  id: string;
  code: string;
  name: string;
  parent_id?: string | null;
  is_active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category_id?: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  name_es?: string;
  description_es?: string;
  generated_description_es?: string;
  generated_description?: string;
  is_active: boolean;
  attributes?: ProductAttributeValue[];
};

export type ProductAttributeValue = {
  id?: string;
  category_attribute_id: string;
  attribute_code?: string;
  attribute_name?: string;
  data_type?: string;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
};

export type CategoryAttribute = {
  id: string;
  code: string;
  name: string;
  data_type: string;
  is_required: boolean;
};

export type SKU = {
  id: string;
  product_id?: string;
  code: string;
  name: string;
  description?: string;
  image_url?: string;
  publish_compras_paraguai: boolean;
  publish_ecommerce: boolean;
  is_active: boolean;
};

export type PaymentIntent = {
  id: string;
  order_id: string;
  amount_usd: number;
  provider: string;
  status: string;
  client_secret: string;
};

export type CadastroResult = {
  product: Product;
  sku: SKU;
  label: {
    description: string;
    sku: string;
    qr_content: string;
  };
};

export type Availability = {
  sku_id: string;
  warehouse_id: string;
  qty_physical: number;
  qty_reserved: number;
  qty_available: number;
};

export type InventoryUnit = {
  id: string;
  unit_code: string;
  sku_id: string;
  status?: string;
  Status?: string;
  unit_cost_usd?: number;
  order_id?: string;
};

export type InventoryUnitDetail = {
  id: string;
  unit_code: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  product_id: string;
  product_name: string;
  product_description?: string;
  brand?: string;
  category_name?: string;
  status: string;
  warehouse_id: string;
  unit_cost_usd?: number;
  received_at?: string;
  available_at?: string;
  sold_at?: string;
  order_id?: string;
  purchase_id?: string;
  po_number?: string;
  serial_number?: string;
};

export type InventoryUnitReceive = {
  id: string;
  unit_code: string;
  sku_id: string;
  status: string;
  serial_number?: string;
};

export type StockBalanceRow = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  warehouse_id: string;
  qty_physical: number;
  qty_reserved: number;
  qty_available: number;
};

export type StockMovementRow = {
  id: string;
  movement_type: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  warehouse_id: string;
  inventory_unit_id?: string;
  unit_code?: string;
  quantity: number;
  status_before?: string;
  status_after?: string;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  created_at: string;
};

export type IntakeQueueItem = {
  id: string;
  unit_code: string;
  sku_id: string;
  sku_code: string;
  sku_name?: string;
  warehouse_id: string;
  status: string;
  purchase_id?: string;
  po_number?: string;
  unit_cost_usd?: number;
  received_at?: string;
  serial_number?: string;
  has_intake_photo?: boolean;
  next_action: string;
  intake_batch_id?: string;
  batch_photo_count?: number;
};

export type IntakeBatchPhoto = {
  id: string;
  batch_id: string;
  sort_order: number;
  created_at: string;
};

export type Customer = {
  id: string;
  type: string;
  name: string;
  email?: string;
  phone?: string;
  document_id?: string;
  residency?: string;
  nationality?: string;
  document_type?: string;
  has_document_scan?: boolean;
  credit_limit_usd: number;
  payment_terms_days?: number;
  is_active?: boolean;
};

export type QuoteItem = {
  id: string;
  sku_id: string;
  quantity: number;
  unit_price_usd: number;
  line_total_usd: number;
};

export type Quote = {
  id: string;
  quote_number: string;
  customer_id: string;
  status: string;
  channel: string;
  discount_pct: number;
  notes?: string;
  items?: QuoteItem[];
  total_usd: number;
  created_at: string;
};

export type QuoteListItem = {
  id: string;
  quote_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  channel: string;
  total_usd: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  sku_id: string;
  sku_code?: string;
  sku_name?: string;
  quantity: number;
  unit_price_usd: number;
  line_total_usd: number;
};

export type OrderShipPhoto = {
  id: string;
  order_id: string;
  order_item_id: string;
  sku_id: string;
  sku_code?: string;
  sku_name?: string;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  quote_id?: string;
  channel: string;
  status: string;
  warehouse_id: string;
  discount_pct: number;
  subtotal_usd: number;
  total_usd: number;
  items?: OrderItem[];
  ship_photos?: OrderShipPhoto[];
  confirmed_at?: string;
  paid_at?: string;
  created_at: string;
};

export type OrderListItem = {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  channel: string;
  total_usd: number;
  quote_id?: string;
  matched_unit_code?: string;
  matched_order_item_id?: string;
  created_at: string;
};

export type SKUPrice = {
  sku_id: string;
  cost_usd?: number;
  min_price_usd?: number;
  price_b2c_usd?: number;
  price_b2b_usd?: number;
  price_reseller_usd?: number;
  price_promo_usd?: number;
  updated_at: string;
};

export type ExchangeRateQuote = {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  label: string;
  symbol: string;
};

export type ExchangeRatesToday = {
  base_currency: string;
  as_of: string;
  rates: ExchangeRateQuote[];
  source?: string;
  fetched_at?: string;
  provider_updated_at?: string;
};

export type ResolvedPrice = {
  sku_id: string;
  channel: string;
  base_price_usd: number;
  price_with_iva_usd: number;
  price_pyg?: number;
  price_with_iva_pyg?: number;
  exchange_rate_usd_pyg?: number;
  promo_applied: boolean;
};

export type DashboardStats = {
  orders_draft: number;
  orders_pending_ship: number;
  quotes_open: number;
  receivables_open: number;
  receivables_outstanding_usd: number;
  skus_low_stock: number;
  active_skus: number;
  sales_month_usd: number;
  sales_month_orders: number;
};

export type PendingOrderSummary = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total_usd: number;
  created_at: string;
};

export type LowStockSKU = {
  sku_id?: string;
  sku_code: string;
  name?: string;
  sku_name?: string;
  qty_available: number;
  qty_physical?: number;
  qty_reserved?: number;
};

export type DashboardData = {
  stats: DashboardStats;
  pending_orders: PendingOrderSummary[];
  low_stock_skus: LowStockSKU[];
};

export type AnalyticsSummary = {
  revenue_usd: number;
  cogs_usd: number;
  gross_margin_usd: number;
  gross_margin_pct: number;
  units_sold: number;
  orders_count: number;
  skus_sold: number;
  class_a_count: number;
  class_b_count: number;
  class_c_count: number;
};

export type ProductAnalyticsRow = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  qty_sold: number;
  revenue_usd: number;
  cogs_usd: number;
  margin_usd: number;
  margin_pct: number;
  share_pct: number;
  cumulative_pct: number;
  abc_class: string;
};

export type AnalyticsDashboard = {
  period: { from: string; to: string };
  metric: string;
  channel?: string;
  summary: AnalyticsSummary;
  products: ProductAnalyticsRow[];
};

export type ReceivableListItem = {
  id: string;
  order_id: string;
  customer_id: string;
  amount_usd: number;
  paid_usd: number;
  due_date: string;
  status: string;
  customer_name: string;
  order_number: string;
};

export type FeedSyncLog = {
  id: string;
  channel: string;
  status: string;
  item_count: number;
  skipped_count: number;
  content_hash?: string;
  duration_ms?: number;
  trigger_source: string;
  error_message?: string;
  created_at: string;
};

export type FeedSyncLogDetail = FeedSyncLog & {
  entries?: {
    id: string;
    sku_code: string;
    action: string;
    reason?: string;
  }[];
};

export type FeedDiagnosticItem = {
  sku_code: string;
  status: string;
  reason?: string;
  stock_available: number;
  price_b2c_usd?: number;
  published: boolean;
};

export type FeedDiagnostics = {
  included_count: number;
  skipped_count: number;
  unpublished_count: number;
  items: FeedDiagnosticItem[];
};
