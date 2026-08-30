import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameEventKind } from "@shared/game/events.ts";
import { engineVersion } from "@shared/version.ts";

export type NewGameEvent = {
  readonly kind: GameEventKind;
  readonly player: string | null;
  readonly action: unknown;
  readonly result: unknown;
  readonly state: unknown;
};

/** Append events for a game with consecutive sequence numbers. Never throws. */
export const appendGameEvents = async (
  supabase: SupabaseClient,
  gameId: string,
  events: ReadonlyArray<NewGameEvent>,
): Promise<void> => {
  if (events.length === 0) return;
  try {
    const { data } = await supabase
      .from("game_events")
      .select("seq")
      .eq("game_id", gameId)
      .order("seq", { ascending: false })
      .limit(1);
    const last = (data?.[0]?.seq as number | undefined) ?? -1;
    const rows = events.map((event, index) => ({
      game_id: gameId,
      seq: last + 1 + index,
      kind: event.kind,
      player: event.player,
      action: event.action ?? null,
      result: event.result ?? null,
      state: event.state ?? null,
      engine_version: engineVersion,
    }));
    const { error } = await supabase.from("game_events").insert(rows);
    if (error !== null) console.error("Failed to append game events:", error.message);
  } catch (caught) {
    console.error("Failed to append game events:", caught);
  }
};

/** Record an unhandled failure against a game (if known) */
export const recordError = async (
  supabase: SupabaseClient,
  gameId: string | null,
  caught: unknown,
  context: unknown,
): Promise<void> => {
  const message = caught instanceof Error ? caught.message : String(caught);
  const stack = caught instanceof Error ? caught.stack : undefined;
  console.error("Unhandled error:", message, stack);
  if (gameId === null) return;
  await appendGameEvents(supabase, gameId, [
    { kind: "error", player: null, action: context, result: null, state: { message, stack } },
  ]);
};
