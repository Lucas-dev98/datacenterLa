-- Refresh U.2 SSD product photo (OCZ Z-Drive 6300 on black background).

UPDATE skus s
SET image_url = '/static/products/ssd-u2.jpg'
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE s.product_id = p.id
  AND c.code LIKE 'SSD_%'
  AND c.code NOT IN ('SSD_M2', 'SSD_SATA')
  AND (
    s.image_url IS NULL
    OR btrim(s.image_url) = ''
    OR s.image_url = '/static/products/ssd-u2-dark.jpg'
  );
