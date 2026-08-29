-- Fill SKU photos from backend static files. Only empty image_url rows are updated.

UPDATE skus s
SET image_url = CASE
  WHEN lower(s.name) LIKE '%rtx 6000 ada%' THEN '/static/products/gpu-nvidia-rtx-6000-ada.jpg'
  WHEN lower(s.name) LIKE '%poweredge r650%' THEN '/static/products/dell-poweredge-r650.png'
  WHEN lower(s.name) LIKE '%poweredge r750%' THEN '/static/products/dell-poweredge-r750.png'
  WHEN lower(s.name) LIKE '%dl380%' AND (lower(s.name) LIKE '%plus%' OR lower(s.name) LIKE '%gen10+%') THEN '/static/products/hpe-dl380-gen10-plus.jpg'
  WHEN lower(s.name) LIKE '%sr650%' AND lower(s.name) LIKE '%lenovo%' THEN '/static/products/lenovo-sr650-v3.png'
  WHEN lower(s.name) LIKE '%dl380%' OR lower(s.name) LIKE '%dl360%' OR lower(s.name) LIKE '%proliant%' THEN '/static/products/hpe-dl380.jpg'
  WHEN lower(s.name) LIKE '%catalyst 9300%' OR (lower(s.name) LIKE '%catalyst%' AND lower(s.name) NOT LIKE '%nexus%') THEN '/static/products/cisco-catalyst-9300.png'
  WHEN lower(s.name) LIKE '%nexus%' THEN '/static/products/cisco-nexus-93180.png'
  WHEN lower(s.name) LIKE '%aruba%' THEN '/static/products/aruba-2930f.png'
  WHEN lower(s.name) LIKE '%arista%' OR lower(s.name) LIKE '%7050%' THEN '/static/products/arista-7050sx.png'
  WHEN lower(s.name) LIKE '%juniper%' OR lower(s.name) LIKE '%ex4300%' THEN '/static/products/juniper-ex4300.png'
  WHEN c.code LIKE 'MEM_NOTEBOOK%' THEN '/static/products/rdimm-hynix.jpg'
  WHEN c.code LIKE 'MEM_DDR5%' THEN '/static/products/rdimm-ddr5-ecc.png'
  WHEN c.code LIKE 'MEM_%' THEN '/static/products/rdimm-micron.jpg'
  WHEN c.code LIKE 'SSD_M2%' THEN '/static/products/ssd-m2.jpg'
  WHEN c.code LIKE 'SSD_SATA%' THEN '/static/products/ssd-sata.jpg'
  WHEN c.code LIKE 'SSD_%' THEN '/static/products/ssd-u2.jpg'
  WHEN c.code LIKE 'HDD_%' THEN '/static/products/hdd-exos.jpg'
  WHEN c.code LIKE 'GPU_%' THEN '/static/products/gpu-nvidia.jpg'
  WHEN c.code LIKE 'FONTE_%' THEN '/static/products/psu-atx.jpg'
  WHEN c.code LIKE 'REDE_%' THEN '/static/products/nic-intel.jpg'
  WHEN c.code = 'CPU_AMD' THEN '/static/products/amd-epyc.jpg'
  WHEN c.code = 'CPU_INTEL' THEN '/static/products/intel-xeon.jpg'
  WHEN c.code = 'SRV_RACK_1U' THEN '/static/products/dell-poweredge-1u.jpg'
  WHEN c.code LIKE 'SRV_%' THEN '/static/products/dell-poweredge-rack.jpg'
  WHEN c.code LIKE 'STG_%' AND (lower(s.name) LIKE '%exos%' OR lower(s.name) LIKE '%corvault%') THEN '/static/products/seagate-exos-chassis.png'
  WHEN c.code = 'STG_NAS' AND (lower(s.name) LIKE '%synology%' OR lower(s.name) LIKE '%qnap%') THEN '/static/products/storage-nas.jpg'
  WHEN c.code LIKE 'STG_%' THEN '/static/products/storage-san.jpg'
  WHEN c.code LIKE 'SW_%' THEN '/static/products/cisco-catalyst-9300.png'
  ELSE '/static/products/placeholder.svg'
END
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE s.product_id = p.id
  AND (s.image_url IS NULL OR btrim(s.image_url) = '');
