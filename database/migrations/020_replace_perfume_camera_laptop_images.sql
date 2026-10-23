-- Migration 020: logo-free demo images for perfume (id 5), laptop (id 100) and camera (id 101)
UPDATE products
   SET image_url = '/images/prod_perfume.webp',
       images = JSON_ARRAY('/images/prod_perfume.webp', '/images/prod_perfume_box.webp', '/images/prod_perfume_detail.webp')
 WHERE id = 5;
UPDATE products
   SET image_url = '/images/prod_laptop.webp',
       images = JSON_ARRAY('/images/prod_laptop.webp', '/images/prod_laptop_screen.webp', '/images/prod_laptop_side.webp')
 WHERE id = 100;
UPDATE products
   SET image_url = '/images/prod_camera.webp',
       images = JSON_ARRAY('/images/prod_camera.webp', '/images/prod_camera_lens.webp', '/images/prod_camera_detail.webp')
 WHERE id = 101;
UPDATE product_variants SET image_url = '/images/prod_perfume.webp'       WHERE sku = 'PERF-50ML';
UPDATE product_variants SET image_url = '/images/prod_perfume_box.webp'   WHERE sku = 'PERF-100ML';
UPDATE product_variants SET image_url = '/images/prod_laptop.webp'        WHERE sku = 'LAP-16-512';
UPDATE product_variants SET image_url = '/images/prod_laptop_screen.webp' WHERE sku = 'LAP-32-1TB';
UPDATE product_variants SET image_url = '/images/prod_camera.webp'        WHERE sku = 'CAM-BODY';
UPDATE product_variants SET image_url = '/images/prod_camera_lens.webp'   WHERE sku = 'CAM-KIT';
