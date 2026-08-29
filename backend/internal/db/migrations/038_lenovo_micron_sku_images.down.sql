UPDATE skus s
SET image_url = '/static/products/lenovo-sr650-v3.jpg'
FROM products p
WHERE s.product_id = p.id
  AND lower(s.name) LIKE '%sr650%'
  AND lower(s.name) LIKE '%lenovo%'
  AND s.image_url = '/static/products/lenovo-sr650-v3.png';
