import type { Game } from "./types.ts";
import type { ActionResult, GameAction } from "../actions/index.ts";
import { handleAction } from "./engine.ts";

/**
 * Process a game action and return the result.
 * Thin wrapper around the pure engine functions.
 */
export const processAction = ({
  game,
  action,
}: {
  game: Game;
  action: GameAction;
}): { readonly result: ActionResult; readonly updatedGame: Game } => {
  const { game: updatedGame, result } = handleAction(game, action);
  return { result, updatedGame };
};
