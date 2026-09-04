import type { Game } from "./types.ts";
import type { ActionResult, GameAction } from "../actions/index.ts";
import { handleAction, rememberVisible, tickClock } from "./engine.ts";

/**
 * Process a game action and return the result.
 * Thin wrapper around the pure engine functions. A successful action also
 * refreshes both players' fog-of-war memory and costs one hour on the clock
 * (ending the phase sets the clock itself, so pass is exempt).
 */
export const processAction = ({
  game,
  action,
}: {
  game: Game;
  action: GameAction;
}): { readonly result: ActionResult; readonly updatedGame: Game } => {
  const { game: updatedGame, result } = handleAction(game, action);
  if (!result.success) {
    return { result, updatedGame };
  }
  const remembered = rememberVisible(updatedGame);
  return {
    result,
    updatedGame: action.type === "pass" ? remembered : tickClock(remembered),
  };
};
