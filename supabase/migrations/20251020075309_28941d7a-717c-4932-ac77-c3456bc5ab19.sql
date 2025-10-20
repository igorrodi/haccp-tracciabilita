-- Allow all authorized users to view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Authorized users can view all profiles"
ON public.profiles
FOR SELECT
USING (is_authorized_user(auth.uid()));