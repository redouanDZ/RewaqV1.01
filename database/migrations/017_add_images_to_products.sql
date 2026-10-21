-- Migration 017: Add images column to products table for multi-image galleries
ALTER TABLE products ADD COLUMN images JSON NULL AFTER image_url;
