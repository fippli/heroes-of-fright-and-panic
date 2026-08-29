import { processAction } from "@shared/game/actions";
import type { Game } from "@shared/game/types";
import type { GameAction, ServerGameState } from "./GameTypes";

/**
 * Run an action through the shared engine locally, on the state this client
 * last received, to predict the outcome before the server confirms it.
 *
 * The client only holds the fog-of-war filtered state, so a prediction can
 * differ from the server's verdict (e.g. moving into an unexplored tile). The
 * caller must always replace the prediction with the server's response.
 *
 * Returns null when the engine rejects the action locally or throws; the
 * caller then simply waits for the server.
 */
export const predictAction = (
  state: ServerGameState,
  action: GameAction,
): ServerGameState | null => {
  try {
    const { result, updatedGame } = processAction({
      game: state as unknown as Game,
      action,
    });
    if (!result.success) {
      return null;
    }
    return updatedGame as unknown as ServerGameState;
  } catch {
    return null;
  }
};
