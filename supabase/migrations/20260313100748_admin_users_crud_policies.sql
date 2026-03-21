-- Allow admins to read all admin_users rows (for settings page)
CREATE POLICY "Admins can read all admin users" ON public.admin_users FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Allow admins to add new admin users
CREATE POLICY "Admins can insert admin users" ON public.admin_users FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Allow admins to delete admin users
CREATE POLICY "Admins can delete admin users" ON public.admin_users FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));
