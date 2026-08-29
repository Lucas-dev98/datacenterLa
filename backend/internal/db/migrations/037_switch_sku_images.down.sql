UPDATE skus s
SET image_url = '/static/products/cisco-catalyst.jpg'
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE s.product_id = p.id
  AND c.code LIKE 'SW_%'
  AND s.image_url LIKE '/static/products/%';
