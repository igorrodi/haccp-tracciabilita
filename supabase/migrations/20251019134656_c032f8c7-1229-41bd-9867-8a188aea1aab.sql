-- Modify the lot number generation to be shorter and ensure uniqueness
-- New format: L-YYMMDD-NN (e.g., L-241019-01)

CREATE OR REPLACE FUNCTION public.generate_internal_lot_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_number text;
  counter integer;
  date_part text;
BEGIN
  -- Get current date in format YYMMDD
  SELECT TO_CHAR(CURRENT_DATE, 'YYMMDD') INTO date_part;
  
  -- Count lots created today
  SELECT COUNT(*) INTO counter
  FROM public.haccp_lots
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Create shorter lot number: L-YYMMDD-NN
  new_number := 'L-' || date_part || '-' || LPAD((counter + 1)::text, 2, '0');
  
  -- Ensure uniqueness by checking if it exists
  WHILE EXISTS (SELECT 1 FROM public.haccp_lots WHERE internal_lot_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'L-' || date_part || '-' || LPAD((counter + 1)::text, 2, '0');
  END LOOP;
  
  RETURN new_number;
END;
$function$;