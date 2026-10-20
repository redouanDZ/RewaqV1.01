-- Migration 007: Create Store Settings and Marketing Pixels Table
CREATE TABLE IF NOT EXISTS store_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_settings (setting_key, setting_value) VALUES
('store_name', 'متجر رواق'),
('store_logo', ''),
('store_favicon', ''),
('store_phone', '0550000000'),
('store_whatsapp', '213550000000'),
('store_email', 'contact@rewaq.dz'),
('store_address', 'الجزائر العاصمة، الجزائر'),
('store_currency', 'دج'),
('facebook_url', 'https://facebook.com'),
('instagram_url', 'https://instagram.com'),
('tiktok_url', 'https://tiktok.com'),
('shipping_policy', 'نوفر خدمة التوصيل السريع إلى 58 ولاية خلال 24 إلى 72 ساعة، مع إمكانية التوصيل لباب المنزل أو الاستلام من المكتب.'),
('return_policy', 'يمكنك إرجاع أو استبدال المنتج خلال 48 ساعة من الاستلام في حال وجود أي عيب مصنعي أو عدم مطابقة للمواصفات.'),
('warranty_policy', 'جميع منتجاتنا مضمونة وأصلية 100% مع دعم فني متواصل وخدمة ما بعد البيع.'),
('enable_cod', 'true'),
('enable_chargily', 'true'),
('announcement_bar_text', 'توصيل سريع متوفر لـ 58 ولاية والدفع عند الاستلام!'),
('facebook_pixel_id', ''),
('tiktok_pixel_id', ''),
('google_analytics_id', ''),
('snapchat_pixel_id', '')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
