CREATE INDEX IF NOT EXISTS idx_orders_shipped_analytics
    ON orders (shipped_at)
    WHERE status IN ('shipped', 'delivered');

CREATE INDEX IF NOT EXISTS idx_order_items_sku
    ON order_items (sku_id);

CREATE INDEX IF NOT EXISTS idx_inventory_units_order_item_sold
    ON inventory_units (order_item_id)
    WHERE status = 'sold';
