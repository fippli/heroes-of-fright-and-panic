import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Re-export types and converters from shared
export type { GameClock, GameRow, Game } from "@shared/game/types";
export { rowToGame, gameToRow } from "@shared/game/converters";

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (SUPABASE_URL === undefined) {
  throw new Error("SUPABASE_URL is not set");
}
if (SUPABASE_SERVICE_ROLE_KEY === undefined) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

// Supabase client with service role key (for server-side operations)
// This bypasses RLS and should only be used on the server
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
