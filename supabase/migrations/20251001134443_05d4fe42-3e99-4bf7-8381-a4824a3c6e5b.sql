-- Remove product_name since category is the product
-- Remove temperature, humidity, ph_level fields
ALTER TABLE public.haccp_lots 
DROP COLUMN IF EXISTS product_name,
DROP COLUMN IF EXISTS temperature,
DROP COLUMN IF EXISTS humidity,
DROP COLUMN IF EXISTS ph_level;