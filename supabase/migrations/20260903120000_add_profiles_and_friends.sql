-- Usernames and friendships, so games can be shared without typing emails.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usernames are readable by signed-in players (friend search, seat labels).
-- Emails never live in this table, so none can leak from it; the game-create
-- edge function resolves username -> email with the service role.
CREATE POLICY "Signed-in users can read usernames" ON public.profiles FOR SELECT
  TO authenticated USING (true);

-- Claim your own username once; there is no UPDATE policy, so it is immutable.
CREATE POLICY "Users can claim their own username" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.friendships (
  requester UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  addressee UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (requester, addressee),
  CHECK (requester <> addressee)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can see their friendship" ON public.friendships FOR SELECT
  TO authenticated USING (auth.uid() IN (requester, addressee));

CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester AND status = 'pending');

CREATE POLICY "The addressee can accept" ON public.friendships FOR UPDATE
  TO authenticated USING (auth.uid() = addressee) WITH CHECK (status = 'accepted');

CREATE POLICY "Either party can end it" ON public.friendships FOR DELETE
  TO authenticated USING (auth.uid() IN (requester, addressee));

-- Seat labels: games remember the players' usernames at create/join time,
-- so lists can show names instead of emails (old games fall back to email).
ALTER TABLE public.games
  ADD COLUMN day_player_name TEXT,
  ADD COLUMN night_player_name TEXT;
