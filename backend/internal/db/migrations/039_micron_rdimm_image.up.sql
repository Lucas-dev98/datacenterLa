-- Use the shared Micron RDIMM product photo for all Micron memory SKUs.

UPDATE skus
SET image_url = '/static/products/rdimm-micron.jpg'
WHERE lower(name) LIKE '%micron%'
  AND (
    lower(name) LIKE '%rdimm%'
    OR lower(name) LIKE '%lrdimm%'
    OR lower(name) LIKE '%dimm%'
  )
  AND (
    image_url IS NULL
    OR btrim(image_url) = ''
    OR image_url <> '/static/products/rdimm-micron.jpg'
  );
