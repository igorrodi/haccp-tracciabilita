-- Create printer settings table
CREATE TABLE IF NOT EXISTS public.printer_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  printer_enabled boolean NOT NULL DEFAULT false,
  printer_type text NOT NULL DEFAULT 'thermal',
  label_width integer NOT NULL DEFAULT 100,
  label_height integer NOT NULL DEFAULT 50,
  include_qr_code boolean NOT NULL DEFAULT true,
  include_barcode boolean NOT NULL DEFAULT true,
  include_product_name boolean NOT NULL DEFAULT true,
  include_lot_number boolean NOT NULL DEFAULT true,
  include_expiry_date boolean NOT NULL DEFAULT true,
  include_production_date boolean NOT NULL DEFAULT true,
  font_size text NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;

-- Admins can view all printer settings
CREATE POLICY "Admins can view printer settings"
ON public.printer_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert printer settings
CREATE POLICY "Admins can insert printer settings"
ON public.printer_settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update printer settings
CREATE POLICY "Admins can update printer settings"
ON public.printer_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_printer_settings_updated_at
BEFORE UPDATE ON public.printer_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();