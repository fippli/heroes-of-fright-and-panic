-- Admin Users (simple email allowlist)
CREATE TABLE public.admin_users (
  email TEXT PRIMARY KEY
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own admin status" ON public.admin_users FOR SELECT
  USING (email = auth.email());

-- Themes
CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read themes" ON public.themes FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert themes" ON public.themes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

CREATE POLICY "Admins can update themes" ON public.themes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

CREATE POLICY "Admins can delete themes" ON public.themes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

CREATE TRIGGER themes_updated_at
  BEFORE UPDATE ON public.themes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Theme Assets
CREATE TABLE public.theme_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES public.themes ON DELETE CASCADE,
  category TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (theme_id, category, asset_key)
);

ALTER TABLE public.theme_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read theme assets" ON public.theme_assets FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert theme assets" ON public.theme_assets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

CREATE POLICY "Admins can update theme assets" ON public.theme_assets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

CREATE POLICY "Admins can delete theme assets" ON public.theme_assets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Add theme_id to games
ALTER TABLE public.games ADD COLUMN theme_id UUID REFERENCES public.themes ON DELETE SET NULL;

-- Create public storage bucket for theme assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('theme-assets', 'theme-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read
CREATE POLICY "Public read theme assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'theme-assets');

-- Storage policies: authenticated admins can upload
CREATE POLICY "Admins can upload theme assets" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'theme-assets'
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email())
  );

-- Storage policies: authenticated admins can update
CREATE POLICY "Admins can update theme assets" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'theme-assets'
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email())
  );

-- Storage policies: authenticated admins can delete
CREATE POLICY "Admins can delete theme assets" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'theme-assets'
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email())
  );
