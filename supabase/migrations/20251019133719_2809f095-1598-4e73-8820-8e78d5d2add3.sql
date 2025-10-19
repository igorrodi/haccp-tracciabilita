-- Add ON DELETE CASCADE to category_id foreign key in haccp_lots
-- This ensures that when a category is deleted, all associated lots are also deleted

-- First, drop the existing foreign key constraint if it exists
ALTER TABLE public.haccp_lots 
DROP CONSTRAINT IF EXISTS haccp_lots_category_id_fkey;

-- Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.haccp_lots 
ADD CONSTRAINT haccp_lots_category_id_fkey 
FOREIGN KEY (category_id) 
REFERENCES public.product_categories(id) 
ON DELETE CASCADE;