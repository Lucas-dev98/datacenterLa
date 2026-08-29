-- Replace the shared Catalyst 2960 rack photo with per-SKU switch product shots.

UPDATE skus s
SET image_url = CASE
  WHEN lower(s.name) LIKE '%catalyst 9300%' OR (lower(s.name) LIKE '%catalyst%' AND lower(s.name) NOT LIKE '%nexus%') THEN '/static/products/cisco-catalyst-9300.png'
  WHEN lower(s.name) LIKE '%nexus%' THEN '/static/products/cisco-nexus-93180.png'
  WHEN lower(s.name) LIKE '%aruba%' THEN '/static/products/aruba-2930f.png'
  WHEN lower(s.name) LIKE '%arista%' OR lower(s.name) LIKE '%7050%' THEN '/static/products/arista-7050sx.png'
  WHEN lower(s.name) LIKE '%juniper%' OR lower(s.name) LIKE '%ex4300%' THEN '/static/products/juniper-ex4300.png'
  ELSE '/static/products/cisco-catalyst-9300.png'
END
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE s.product_id = p.id
  AND c.code LIKE 'SW_%'
  AND (
    s.image_url IS NULL
    OR btrim(s.image_url) = ''
    OR s.image_url = '/static/products/cisco-catalyst.jpg'
  );
