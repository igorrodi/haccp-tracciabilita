-- Fix security warnings: Set search_path for functions

-- Update generate_internal_lot_number function with search_path
CREATE OR REPLACE FUNCTION public.generate_internal_lot_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update set_internal_lot_number function with search_path
CREATE OR REPLACE FUNCTION public.set_internal_lot_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_lot_number IS NULL THEN
    NEW.internal_lot_number := public.generate_internal_lot_number();
  END IF;
  RETURN NEW;
END;
$$;