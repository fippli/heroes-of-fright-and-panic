-- Faction flavor for resources: same mechanic, your own name for it
-- (faith -> sin for devils, mana for magicians). { "<resource>": { "name": "..." } }
ALTER TABLE public.factions ADD COLUMN resources JSONB NOT NULL DEFAULT '{}'::jsonb;
