-- Player-owned factions: a personal reskin of one of the two rule-sets.
-- The engine still plays peasant/king/priest/archAngel; a faction gives
-- those tiers custom names and images that everyone in the game sees.

CREATE TABLE public.factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  -- The base rule-set the faction reskins; decides clock and rules
  type TEXT NOT NULL CHECK (type IN ('day', 'night')),
  -- { "<pieceKind>": { "name": "...", "imagePath": "..." } }
  pieces JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.factions ENABLE ROW LEVEL SECURITY;

-- Everyone in a game must be able to see the opponent's faction
CREATE POLICY "Anyone can read factions" ON public.factions FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert factions" ON public.factions FOR INSERT
  WITH CHECK (owner_email = auth.email());

CREATE POLICY "Owners can update factions" ON public.factions FOR UPDATE
  USING (owner_email = auth.email());

CREATE POLICY "Owners can delete factions" ON public.factions FOR DELETE
  USING (owner_email = auth.email());

CREATE TRIGGER factions_updated_at
  BEFORE UPDATE ON public.factions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Which faction each seat plays with (optional; null = classic look)
ALTER TABLE public.games ADD COLUMN day_faction_id UUID REFERENCES public.factions ON DELETE SET NULL;
ALTER TABLE public.games ADD COLUMN night_faction_id UUID REFERENCES public.factions ON DELETE SET NULL;

-- Public bucket for faction piece images; owners write under their own uid folder
INSERT INTO storage.buckets (id, name, public)
VALUES ('faction-assets', 'faction-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read faction assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'faction-assets');

CREATE POLICY "Owners can upload faction assets" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'faction-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners can update faction assets" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'faction-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners can delete faction assets" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'faction-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
