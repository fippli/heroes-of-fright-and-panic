/**
 * Game event log: an append-only record of a game's creation snapshot and
 * every action applied to it, enough to replay the game and find where a
 * stored state diverged from what the engine produces.
 */
import type { ActionResult, GameAction } from "../actions/index.ts";
import type { PlayerType } from "../piece/index.ts";
import { processAction } from "./actions.ts";
import type { Game } from "./types.ts";

export type GameEventKind = "created" | "action" | "ai" | "error";

export type GameEvent = {
  readonly seq: number;
  readonly kind: GameEventKind;
  readonly player: PlayerType | null;
  readonly action: GameAction | null;
  readonly result: ActionResult | null;
  /** Full game for `created`; a message payload for `error` */
  readonly state: Game | { readonly message: string; readonly stack?: string } | null;
  readonly engineVersion: string | null;
  readonly createdAt?: string;
};

export type ReplayDivergence = {
  readonly seq: number;
  readonly action: GameAction;
  readonly recorded: ActionResult;
  readonly replayed: ActionResult;
};

export type ReplayReport = {
  /** Final game produced by replaying, or null when there was no creation snapshot */
  readonly game: Game | null;
  readonly applied: number;
  /** First event whose replay verdict differs from what was recorded */
  readonly divergence: ReplayDivergence | null;
  readonly error: string | null;
};

const isGame = (state: GameEvent["state"]): state is Game =>
  state !== null && "tiles" in state;

/**
 * Re-run every recorded action from the creation snapshot. Stops at the first
 * event where the engine's verdict no longer matches the recorded one, which
 * pinpoints an engine change or corrupted state.
 */
export const replayEvents = (events: ReadonlyArray<GameEvent>): ReplayReport => {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const created = ordered.find((event) => event.kind === "created");
  if (created === undefined || !isGame(created.state)) {
    return { game: null, applied: 0, divergence: null, error: "No creation snapshot recorded" };
  }

  let game: Game = created.state;
  let applied = 0;
  for (const event of ordered) {
    if ((event.kind !== "action" && event.kind !== "ai") || event.action === null) continue;
    const recorded = event.result ?? { success: true };
    const { result, updatedGame } = processAction({ game, action: event.action });
    if (result.success !== recorded.success) {
      return { game, applied, divergence: { seq: event.seq, action: event.action, recorded, replayed: result }, error: null };
    }
    if (result.success) {
      game = updatedGame;
      applied += 1;
    }
  }
  return { game, applied, divergence: null, error: null };
};

export type StateDiff = {
  readonly clock: boolean;
  readonly currentPlayer: boolean;
  readonly dayResources: boolean;
  readonly nightResources: boolean;
  readonly tiles: ReadonlyArray<{ readonly row: number; readonly column: number }>;
};

/** Where two game states differ (tiles compared structurally) */
export const diffGames = (a: Game, b: Game): StateDiff => {
  const key = (tile: { row: number; column: number }) => `${tile.row},${tile.column}`;
  const bTiles = new Map(b.tiles.map((tile) => [key(tile), tile]));
  const tiles = a.tiles
    .filter((tile) => JSON.stringify(tile) !== JSON.stringify(bTiles.get(key(tile))))
    .map((tile) => ({ row: tile.row, column: tile.column }));
  return {
    clock: JSON.stringify(a.clock) !== JSON.stringify(b.clock),
    currentPlayer: a.currentPlayer !== b.currentPlayer,
    dayResources: JSON.stringify(a.dayPlayer.resources) !== JSON.stringify(b.dayPlayer.resources),
    nightResources: JSON.stringify(a.nightPlayer.resources) !== JSON.stringify(b.nightPlayer.resources),
    tiles,
  };
};
