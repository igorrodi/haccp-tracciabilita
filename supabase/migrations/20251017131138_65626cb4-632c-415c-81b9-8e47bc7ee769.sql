-- Create helper function to check if user has any role (is authorized)
CREATE OR REPLACE FUNCTION public.is_authorized_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Update haccp_lots policies: all authorized users can manage lots
DROP POLICY IF EXISTS "Users can view their own lots" ON public.haccp_lots;
DROP POLICY IF EXISTS "Users can create their own lots" ON public.haccp_lots;
DROP POLICY IF EXISTS "Users can update their own lots" ON public.haccp_lots;
DROP POLICY IF EXISTS "Users can delete their own lots" ON public.haccp_lots;

CREATE POLICY "Authorized users can view all lots"
  ON public.haccp_lots
  FOR SELECT
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can create lots"
  ON public.haccp_lots
  FOR INSERT
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update all lots"
  ON public.haccp_lots
  FOR UPDATE
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete all lots"
  ON public.haccp_lots
  FOR DELETE
  USING (public.is_authorized_user(auth.uid()));

-- Update product_categories policies: only admins manage, all authorized users can view
DROP POLICY IF EXISTS "Users can view their own categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can create their own categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.product_categories;

CREATE POLICY "Authorized users can view all categories"
  ON public.product_categories
  FOR SELECT
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Admins can create categories"
  ON public.product_categories
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
  ON public.product_categories
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
  ON public.product_categories
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update suppliers policies: only admins manage, all authorized users can view
DROP POLICY IF EXISTS "Users can view their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete their own suppliers" ON public.suppliers;

CREATE POLICY "Authorized users can view all suppliers"
  ON public.suppliers
  FOR SELECT
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Admins can create suppliers"
  ON public.suppliers
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update suppliers"
  ON public.suppliers
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete suppliers"
  ON public.suppliers
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update product_images policies: only admins manage, all authorized users can view
DROP POLICY IF EXISTS "Users can view their product images" ON public.product_images;
DROP POLICY IF EXISTS "Users can insert their product images" ON public.product_images;
DROP POLICY IF EXISTS "Users can delete their product images" ON public.product_images;

CREATE POLICY "Authorized users can view all product images"
  ON public.product_images
  FOR SELECT
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Admins can insert product images"
  ON public.product_images
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product images"
  ON public.product_images
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));