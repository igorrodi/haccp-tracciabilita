-- Add freezing_date column to haccp_lots table
ALTER TABLE public.haccp_lots
ADD COLUMN freezing_date date;

-- Add include_freezing_date option to printer_settings
ALTER TABLE public.printer_settings
ADD COLUMN include_freezing_date boolean NOT NULL DEFAULT true;