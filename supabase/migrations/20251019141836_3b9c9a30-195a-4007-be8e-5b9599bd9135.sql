-- Add printer selection fields to printer_settings
ALTER TABLE printer_settings
ADD COLUMN IF NOT EXISTS printer_name text,
ADD COLUMN IF NOT EXISTS printer_connection_type text DEFAULT 'browser' CHECK (printer_connection_type IN ('browser', 'usb', 'network')),
ADD COLUMN IF NOT EXISTS printer_ip_address text,
ADD COLUMN IF NOT EXISTS printer_vendor_id integer,
ADD COLUMN IF NOT EXISTS printer_product_id integer;