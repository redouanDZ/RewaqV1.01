-- Migration 016: Update store settings branding and contact email
-- Ensures that any legacy myshop references or old contact email values in store_settings are updated to Rewaq.

UPDATE store_settings 
SET setting_value = 'contact@rewaq.dz' 
WHERE setting_key = 'store_email' 
  AND (setting_value LIKE '%myshop%' OR setting_value = 'contact@rewaq-store.dz');

UPDATE store_settings 
SET setting_value = 'متجر رواق' 
WHERE setting_key = 'store_name' 
  AND (setting_value LIKE '%myshop%' OR setting_value LIKE '%My Shop%' OR setting_value = 'متجر ماي شوب');

UPDATE store_settings 
SET setting_value = REPLACE(setting_value, 'myshop.dz', 'rewaq.dz') 
WHERE setting_value LIKE '%myshop.dz%';

UPDATE store_settings 
SET setting_value = REPLACE(setting_value, 'myshop', 'rewaq') 
WHERE setting_value LIKE '%myshop%';
