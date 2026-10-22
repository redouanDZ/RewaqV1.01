-- Migration 019: replace branded sneaker gallery/variants with logo-free demo images
UPDATE products
   SET image_url = '/images/prod_sneakers.webp',
       images = JSON_ARRAY('/images/prod_sneakers.webp', '/images/prod_sneakers_sole.webp', '/images/prod_sneakers_detail.webp')
 WHERE id = 3;
UPDATE product_variants
   SET sku = REPLACE(sku, 'SNK-BLK-42', 'SNK-43'),
       name = REPLACE(REPLACE(name, 'رمادي رياضي', 'أبيض'), 'أسود داكن', 'أبيض'),
       image_url = '/images/prod_sneakers.webp',
       price_modifier = 0
 WHERE product_id = 3;
