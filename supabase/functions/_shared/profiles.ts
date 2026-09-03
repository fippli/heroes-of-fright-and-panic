import type { SupabaseClient } from "@supabase/supabase-js";

/** The username a user has claimed, or null before they claim one */
export const usernameOf = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return (data?.username as string | undefined) ?? null;
};

/**
 * Resolve a username to the account's email (service role only — emails are
 * never exposed to clients through profiles). Null when no such player.
 */
export const resolveUsername = async (
  supabase: SupabaseClient,
  username: string,
): Promise<{ email: string; username: string } | null> => {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (profile === null || profile === undefined) return null;
  const { data } = await supabase.auth.admin.getUserById(profile.id as string);
  const email = data?.user?.email;
  if (email === undefined || email === null) return null;
  return { email, username: profile.username as string };
};
