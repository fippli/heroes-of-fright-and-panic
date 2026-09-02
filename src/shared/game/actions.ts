import type { Game } from "./types.ts";
import type { ActionResult, GameAction } from "../actions/index.ts";
import { handleAction, rememberVisible } from "./engine.ts";

/**
 * Process a game action and return the result.
 * Thin wrapper around the pure engine functions. A successful action also
 * refreshes both players' fog-of-war memory of what their vision covers.
 */
export const processAction = ({
  game,
  action,
}: {
  game: Game;
  action: GameAction;
}): { readonly result: ActionResult; readonly updatedGame: Game } => {
  const { game: updatedGame, result } = handleAction(game, action);
  return {
    result,
    updatedGame: result.success ? rememberVisible(updatedGame) : updatedGame,
  };
};
