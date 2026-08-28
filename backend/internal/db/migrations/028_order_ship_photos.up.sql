CREATE TABLE IF NOT EXISTS order_ship_photos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    sku_id          UUID NOT NULL REFERENCES skus(id),
    file_path       TEXT NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_ship_photos_order_id ON order_ship_photos(order_id);
