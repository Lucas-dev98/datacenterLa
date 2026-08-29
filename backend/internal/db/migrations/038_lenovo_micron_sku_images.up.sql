-- Replace Lenovo SR650 V3 photo with high-quality product shot (PNG).
-- Micron RDIMM photo (rdimm-micron.jpg) was updated in static files; URLs unchanged.

UPDATE skus s
SET image_url = '/static/products/lenovo-sr650-v3.png'
FROM products p
WHERE s.product_id = p.id
  AND lower(s.name) LIKE '%sr650%'
  AND lower(s.name) LIKE '%lenovo%'
  AND (
    s.image_url IS NULL
    OR btrim(s.image_url) = ''
    OR s.image_url = '/static/products/lenovo-sr650-v3.jpg'
  );
