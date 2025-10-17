-- Set current user as admin (run this manually for the first admin)
-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get user ID from profiles table by looking for any existing user
  SELECT user_id INTO admin_user_id
  FROM public.profiles
  LIMIT 1;
  
  -- If a user exists, make them admin
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, authorized_by, authorized_at)
    VALUES (admin_user_id, 'admin', admin_user_id, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;