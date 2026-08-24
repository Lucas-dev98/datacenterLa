-- Remove duplicate unit lines before adding uniqueness (keep oldest row).
DELETE FROM stock_count_lines a
USING stock_count_lines b
WHERE a.id > b.id
  AND a.stock_count_id = b.stock_count_id
  AND a.inventory_unit_id IS NOT NULL
  AND a.inventory_unit_id = b.inventory_unit_id;

CREATE UNIQUE INDEX idx_stock_count_lines_unit_unique
  ON stock_count_lines (stock_count_id, inventory_unit_id)
  WHERE inventory_unit_id IS NOT NULL;
