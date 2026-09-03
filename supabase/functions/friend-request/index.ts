import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Send a friend request to a player named by username or email. Emails are
 * resolved with the service role so they never leave the server; if the
 * other player already sent a request this way, the two become friends.
 */
Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse !== null) return corsResponse;
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUserFromRequest(request);
  if (user === null) return json({ error: "Authentication required" }, 401);

  const body = await request.json();
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query === "") return json({ error: "Give a username or email" }, 400);

  const supabase = createAdminClient();

  // Resolve the target's user id
  let targetId: string | null = null;
  if (query.includes("@")) {
    const { data, error } = await supabase.rpc("user_id_by_email", { lookup: query });
    if (error !== null) console.error("Email lookup failed:", error.message);
    targetId = (data as string | null) ?? null;
    if (targetId === null) {
      return json({ error: "No player with that email — invite them to a game by email instead, they can befriend you after signing up" }, 404);
    }
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", query.toLowerCase())
      .maybeSingle();
    targetId = (data?.id as string | undefined) ?? null;
    if (targetId === null) return json({ error: `No player named "${query}"` }, 404);
  }

  if (targetId === user.id) return json({ error: "That's you" }, 400);

  // Friendships reference profiles: the target must have claimed a username
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", targetId)
    .maybeSingle();
  if (targetProfile === null || targetProfile === undefined) {
    return json({ error: "That player hasn't picked a username yet" }, 404);
  }
  const targetName = targetProfile.username as string;

  // A pending request from them meets this one in the middle
  const { data: reverse } = await supabase
    .from("friendships")
    .select("status")
    .eq("requester", targetId)
    .eq("addressee", user.id)
    .maybeSingle();
  if (reverse !== null && reverse !== undefined) {
    if (reverse.status !== "accepted") {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("requester", targetId)
        .eq("addressee", user.id);
    }
    return json({ status: "friends", username: targetName });
  }

  const { error: insertError } = await supabase
    .from("friendships")
    .insert({ requester: user.id, addressee: targetId });
  if (insertError !== null) {
    return json(
      { error: insertError.code === "23505" ? "Request already sent" : insertError.message },
      400,
    );
  }
  return json({ status: "sent", username: targetName });
});
