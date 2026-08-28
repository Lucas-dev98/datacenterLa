-- Keep image_url column; only undo the default fill if still pointing at /static/products/.

UPDATE skus
SET image_url = NULL
WHERE image_url LIKE '/static/products/%';
