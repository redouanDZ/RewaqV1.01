-- Migration 018: clean demo galleries and remove third-party brand names from demo text
-- (the live database may still hold older demo data that the seed script does not overwrite).
UPDATE products SET images = JSON_ARRAY('/images/prod_classic_watch.webp', '/images/prod_classic_watch_detail.webp') WHERE id = 4;
UPDATE products SET images = JSON_ARRAY('/images/prod_cookware.webp', '/images/prod_cookware_pan.webp') WHERE id = 6;
UPDATE product_variants SET image_url = '/images/prod_classic_watch_detail.webp' WHERE product_id = 4 AND image_url LIKE '%prod_classic_watch_angle%';
UPDATE products SET description = 'كاميرا تصوير رقمية احترافية مزودة بمستشعر متطور وعدسة تصوير عالية الدقة، تدعم تصوير الفيديو بدقة 4K مع تركيز بؤري فائق السرعة وشاشة متحركة لإنتاج محتوى متميز.'
 WHERE id = 101 AND (description LIKE '%Sony%' OR description LIKE '%Canon%');
