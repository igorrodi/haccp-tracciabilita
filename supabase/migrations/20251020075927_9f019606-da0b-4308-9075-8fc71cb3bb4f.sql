-- Add custom_layout column to printer_settings to store label layout configuration
ALTER TABLE public.printer_settings
ADD COLUMN IF NOT EXISTS custom_layout jsonb DEFAULT NULL;

COMMENT ON COLUMN public.printer_settings.custom_layout IS 'Stores custom positions and sizes for label fields';

-- Allow all authorized users to view printer settings (needed for printing)
DROP POLICY IF EXISTS "Admins can view printer settings" ON public.printer_settings;

CREATE POLICY "Authorized users can view printer settings"
ON public.printer_settings
FOR SELECT
USING (is_authorized_user(auth.uid()));