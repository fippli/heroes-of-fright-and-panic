import { supabase, getEdgeFunctionError } from "../lib/supabase";
import { reportClientError } from "../lib/error-report";
import type { ActionResponse, GameAction, ServerGameState } from "./GameTypes";

/** A request that never settles would freeze the UI (input is blocked while an action is in flight) */
const ACTION_TIMEOUT_MS = 20_000;
const POLL_TIMEOUT_MS = 15_000;

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });

/**
 * GameClient handles all communication with the game server.
 * Sends actions and polls for state updates.
 */
export class GameClient {
  private isProcessingAction: boolean = false;
  private pollIntervalId: number | null = null;
  private readonly POLL_INTERVAL_MS = 2000;

  startPolling(
    gameId: string,
    onUpdate: (game: ServerGameState) => void,
  ): void {
    if (this.pollIntervalId !== null) return;

    this.pollIntervalId = window.setInterval(async () => {
      if (this.isProcessingAction) return;

      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke("game-state", { body: { gameId } }),
          POLL_TIMEOUT_MS,
          "game-state",
        );
        // An action started while this poll was in flight; its response is
        // newer than this snapshot, so drop it.
        if (this.isProcessingAction) return;
        if (error === null && data !== null) {
          onUpdate(data as ServerGameState);
        }
      } catch (pollError) {
        console.warn("Polling error:", pollError);
      }
    }, this.POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  async sendAction(
    gameId: string,
    action: GameAction,
  ): Promise<{ success: boolean; response?: ActionResponse }> {
    if (this.isProcessingAction) {
      console.log("Action already in progress, ignoring");
      return { success: false };
    }

    this.isProcessingAction = true;

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("game-action", { body: { gameId, action } }),
        ACTION_TIMEOUT_MS,
        "game-action",
      );

      if (error !== null) {
        const message = await getEdgeFunctionError(error);
        console.error("Error sending action:", message);
        reportClientError({ gameId, player: action.player, message: `game-action failed: ${message}`, context: { action } });
        return { success: false };
      }

      const response = data as ActionResponse;
      return { success: response.result.success, response };
    } catch (actionError) {
      console.error("Error sending action:", actionError);
      reportClientError({
        gameId,
        player: action.player,
        message: actionError instanceof Error ? actionError.message : String(actionError),
        stack: actionError instanceof Error ? actionError.stack : undefined,
        context: { action, source: "sendAction" },
      });
      return { success: false };
    } finally {
      this.isProcessingAction = false;
    }
  }
}
