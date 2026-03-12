-- Supabase PostgreSQL Schema for Heroes of Fright and Panic
-- Run this in your Supabase SQL Editor to set up the database

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  size INTEGER NOT NULL DEFAULT 15,
  tiles JSONB NOT NULL DEFAULT '[]',
  day_player JSONB NOT NULL,
  night_player JSONB NOT NULL,
  current_player TEXT NOT NULL DEFAULT 'day',
  clock JSONB NOT NULL DEFAULT '{"time": 6, "hasDawned": true, "hasDusked": false}',
  creator_email TEXT NOT NULL,
  day_player_email TEXT,
  night_player_email TEXT,
  day_player_last_move TIMESTAMPTZ,
  night_player_last_move TIMESTAMPTZ,
  invited_email TEXT,
  game_over BOOLEAN DEFAULT FALSE,
  winner TEXT
);

-- Indexes for common queries
CREATE INDEX idx_games_creator ON public.games(creator_email);
CREATE INDEX idx_games_day_player ON public.games(day_player_email);
CREATE INDEX idx_games_night_player ON public.games(night_player_email);
CREATE INDEX idx_games_invited ON public.games(invited_email);
CREATE INDEX idx_games_updated ON public.games(updated_at DESC);

-- Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view games they're involved in
CREATE POLICY "Users can view their games" ON public.games FOR SELECT
  USING (
    creator_email = auth.email()
    OR day_player_email = auth.email()
    OR night_player_email = auth.email()
    OR invited_email = auth.email()
  );

-- Policy: Authenticated users can create games
CREATE POLICY "Authenticated users can create games" ON public.games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Players can update games they're part of
CREATE POLICY "Players can update their games" ON public.games FOR UPDATE
  USING (
    day_player_email = auth.email()
    OR night_player_email = auth.email()
  );

-- Policy: Only creators can delete games
CREATE POLICY "Creators can delete games" ON public.games FOR DELETE
  USING (creator_email = auth.email());

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Admin Users (simple email allowlist)
-- ============================================

CREATE TABLE public.admin_users (
  email TEXT PRIMARY KEY
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own row
CREATE POLICY "Users can read own admin status" ON public.admin_users FOR SELECT
  USING (email = auth.email());

-- ============================================
-- Themes
-- ============================================

CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Anyone can read themes (needed to load game images)
CREATE POLICY "Anyone can read themes" ON public.themes FOR SELECT
  USING (true);

-- Only admins can insert themes
CREATE POLICY "Admins can insert themes" ON public.themes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Only admins can update themes
CREATE POLICY "Admins can update themes" ON public.themes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Only admins can delete themes
CREATE POLICY "Admins can delete themes" ON public.themes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

CREATE TRIGGER themes_updated_at
  BEFORE UPDATE ON public.themes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Theme Assets
-- ============================================

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

-- Anyone can read theme assets (needed to load game images)
CREATE POLICY "Anyone can read theme assets" ON public.theme_assets FOR SELECT
  USING (true);

-- Only admins can insert theme assets
CREATE POLICY "Admins can insert theme assets" ON public.theme_assets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Only admins can update theme assets
CREATE POLICY "Admins can update theme assets" ON public.theme_assets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- Only admins can delete theme assets
CREATE POLICY "Admins can delete theme assets" ON public.theme_assets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email()));

-- ============================================
-- Add theme_id to games table
-- ============================================

ALTER TABLE public.games ADD COLUMN theme_id UUID REFERENCES public.themes ON DELETE SET NULL;
