-- Update RLS policy to allow only admins to delete lots
DROP POLICY IF EXISTS "Authorized users can delete all lots" ON public.haccp_lots;

CREATE POLICY "Only admins can delete lots"
ON public.haccp_lots
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));