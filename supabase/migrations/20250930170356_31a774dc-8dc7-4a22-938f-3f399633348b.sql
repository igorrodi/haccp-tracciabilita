-- Add new columns to haccp_lots table
ALTER TABLE public.haccp_lots 
ADD COLUMN internal_lot_number text,
ADD COLUMN is_frozen boolean DEFAULT false,
ADD COLUMN label_image_url text;

-- Create function to generate internal lot number
CREATE OR REPLACE FUNCTION public.generate_internal_lot_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_number text;
  counter integer;
BEGIN
  -- Get current date in format YYYYMMDD
  SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') INTO new_number;
  
  -- Count lots created today
  SELECT COUNT(*) INTO counter
  FROM public.haccp_lots
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Append counter with leading zeros
  new_number := 'L.' || new_number || LPAD((counter + 1)::text, 4, '0');
  
  RETURN new_number;
END;
$$;

-- Create trigger to auto-generate internal lot number
CREATE OR REPLACE FUNCTION public.set_internal_lot_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.internal_lot_number IS NULL THEN
    NEW.internal_lot_number := public.generate_internal_lot_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_internal_lot_number
BEFORE INSERT ON public.haccp_lots
FOR EACH ROW
EXECUTE FUNCTION public.set_internal_lot_number();

-- Create table for product images
CREATE TABLE public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their product images"
ON public.product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.product_categories
    WHERE product_categories.id = product_images.category_id
    AND product_categories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their product images"
ON public.product_images
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_categories
    WHERE product_categories.id = product_images.category_id
    AND product_categories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their product images"
ON public.product_images
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.product_categories
    WHERE product_categories.id = product_images.category_id
    AND product_categories.user_id = auth.uid()
  )
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-images', 'product-images', true),
  ('label-images', 'label-images', false);

-- Storage policies for product images
CREATE POLICY "Public product images are viewable by everyone"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Users can upload product images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their product images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their product images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);

-- Storage policies for label images
CREATE POLICY "Users can view their label images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'label-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload label images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'label-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their label images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'label-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);