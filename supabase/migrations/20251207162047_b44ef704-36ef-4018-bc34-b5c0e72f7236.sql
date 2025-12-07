-- Allow first admin creation when no admins exist
CREATE OR REPLACE FUNCTION public.is_first_admin_setup()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
$$;

-- Policy to allow first admin to be created
CREATE POLICY "Allow first admin creation"
ON public.user_roles
FOR INSERT
WITH CHECK (
  -- Either user is already admin, or this is the first admin setup
  has_role(auth.uid(), 'admin'::app_role) OR is_first_admin_setup()
);