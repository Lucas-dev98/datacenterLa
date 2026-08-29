-- Refresh network adapter product photo (Intel PCIe NIC on black background).

UPDATE skus s
SET image_url = '/static/products/nic-intel.jpg'
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE s.product_id = p.id
  AND c.code LIKE 'REDE_%'
  AND (
    s.image_url IS NULL
    OR btrim(s.image_url) = ''
    OR s.image_url <> '/static/products/nic-intel.jpg'
  );
