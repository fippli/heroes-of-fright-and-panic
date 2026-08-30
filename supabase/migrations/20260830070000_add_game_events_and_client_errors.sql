-- Append-only log of everything that happens to a game, so any game can be
-- replayed from its creation snapshot, plus a sink for browser-side errors.

CREATE TABLE public.game_events (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  -- created: seq 0, carries the full initial game in `state`
  -- action:  a player's action and the engine's verdict
  -- ai:      an action the AI opponent took
  -- error:   an unhandled failure while handling a request
  kind TEXT NOT NULL CHECK (kind IN ('created', 'action', 'ai', 'error')),
  player TEXT,
  action JSONB,
  result JSONB,
  state JSONB,
  engine_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game_id, seq)
);

CREATE INDEX game_events_game_seq ON public.game_events (game_id, seq);

ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Open for reading while the game is in development (the debug endpoint
-- redacts emails); only edge functions (service role) write.
CREATE POLICY "Anyone can read game events" ON public.game_events FOR SELECT
  USING (true);

CREATE TABLE public.client_errors (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID,
  player TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  user_agent TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX client_errors_game ON public.client_errors (game_id, created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can report a client error" ON public.client_errors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read client errors" ON public.client_errors FOR SELECT
  USING (true);
