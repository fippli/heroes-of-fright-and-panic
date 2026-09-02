/**
 * Poke clients subscribed to this game's realtime channel that the state
 * changed. The payload carries no game data — clients react by fetching
 * game-state, which applies auth and fog-of-war filtering. Never throws.
 */
export const broadcastGameUpdate = async (
  gameId: string,
  updatedAt: Date,
): Promise<void> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl === undefined || serviceRoleKey === undefined) return;

  try {
    const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `game-${gameId}`,
            event: "updated",
            payload: { updatedAt: updatedAt.toISOString() },
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("Broadcast failed:", response.status, await response.text());
    }
  } catch (caught) {
    console.error("Broadcast failed:", caught);
  }
};
