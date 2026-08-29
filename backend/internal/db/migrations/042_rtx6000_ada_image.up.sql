-- Refresh NVIDIA RTX 6000 Ada Generation product photo.

UPDATE skus
SET image_url = '/static/products/gpu-nvidia-rtx-6000-ada.jpg'
WHERE lower(name) LIKE '%rtx 6000 ada%'
  AND (
    image_url IS NULL
    OR btrim(image_url) = ''
    OR image_url <> '/static/products/gpu-nvidia-rtx-6000-ada.jpg'
  );
