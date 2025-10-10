-- Add shelf_life_days column to product_categories table
ALTER TABLE public.product_categories 
ADD COLUMN shelf_life_days integer;

COMMENT ON COLUMN public.product_categories.shelf_life_days IS 'Giorni di conservazione/scadenza del prodotto';