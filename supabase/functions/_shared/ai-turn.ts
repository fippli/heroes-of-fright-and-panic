import type { SupabaseClient } from "@supabase/supabase-js";
import { gameToRow } from "@shared/game/converters.ts";
import type { Game } from "@shared/game/types.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import { playAiPhase } from "@shared/ai/index.ts";
import { createRandom } from "@shared/utils/random.ts";
import { appendGameEvents, type NewGameEvent } from "./events.ts";

export const AI_EMAIL = "ai@bot";

export const aiPlayerOf = (game: Game): PlayerType | null => {
  if (game.dayPlayerEmail === AI_EMAIL) return "day";
  if (game.nightPlayerEmail === AI_EMAIL) return "night";
  return null;
};

/** Whether it is currently the AI's phase in an unfinished game */
export const isAiTurn = (game: Game): boolean => {
  const ai = aiPlayerOf(game);
  return ai !== null && game.currentPlayer === ai && game.gameOver !== true;
};

export const persistGame = async (supabase: SupabaseClient, game: Game): Promise<void> => {
  const { error } = await supabase
    .from("games")
    .update(gameToRow({
      tiles: game.tiles,
      dayPlayer: game.dayPlayer,
      nightPlayer: game.nightPlayer,
      currentPlayer: game.currentPlayer,
      clock: game.clock,
      updatedAt: new Date(),
      gameOver: game.gameOver ?? false,
      winner: game.winner ?? null,
    }))
    .eq("id", game.id);
  if (error !== null) console.error("Error persisting game:", error.message);
};

/**
 * Play the AI's phase to its end, persist the result and log every step.
 * Safe to call when it is not the AI's turn (returns the game unchanged).
 */
export const runAiPhase = async (supabase: SupabaseClient, game: Game): Promise<Game> => {
  const ai = aiPlayerOf(game);
  if (ai === null || !isAiTurn(game)) return game;

  const report = playAiPhase(game, ai, createRandom(Date.now()));
  const events: NewGameEvent[] = report.steps.map((step) => ({
    kind: "ai",
    player: ai,
    action: step.action,
    result: step.result,
    state: null,
  }));
  if (report.passedRemainder) {
    events.push({
      kind: "ai",
      player: ai,
      action: null,
      result: { success: false, error: `AI ran out of moves after ${report.attempts} attempts; passed the rest of its phase` },
      state: null,
    });
  }
  await persistGame(supabase, report.game);
  await appendGameEvents(supabase, game.id, events);
  return report.game;
};

/** Run work after the response is sent when the runtime allows it */
export const inBackground = (work: () => Promise<unknown>): Promise<unknown> | void => {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil !== undefined) {
    runtime.waitUntil(work().catch((error) => console.error("Background AI phase failed:", error)));
    return;
  }
  return work();
};
