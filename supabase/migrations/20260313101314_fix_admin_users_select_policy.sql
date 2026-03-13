-- Create a SECURITY DEFINER function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = auth.email()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the circular policy
DROP POLICY IF EXISTS "Admins can read all admin users" ON public.admin_users;

-- Recreate using the SECURITY DEFINER function
CREATE POLICY "Admins can read all admin users" ON public.admin_users FOR SELECT
  USING (public.is_admin());

-- Also update insert and delete policies to use the function
DROP POLICY IF EXISTS "Admins can insert admin users" ON public.admin_users;
CREATE POLICY "Admins can insert admin users" ON public.admin_users FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete admin users" ON public.admin_users;
CREATE POLICY "Admins can delete admin users" ON public.admin_users FOR DELETE
  USING (public.is_admin());
