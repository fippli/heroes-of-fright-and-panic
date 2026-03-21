import { supabase, getEdgeFunctionError } from "../lib/supabase";
import type { ActionResponse, GameAction, ServerGameState } from "./GameTypes";

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
        const { data, error } = await supabase.functions.invoke("game-state", {
          body: { gameId },
        });
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
      const { data, error } = await supabase.functions.invoke("game-action", {
        body: { gameId, action },
      });

      if (error !== null) {
        console.error(
          "Error sending action:",
          await getEdgeFunctionError(error),
        );
        return { success: false };
      }

      const response = data as ActionResponse;
      return { success: response.result.success, response };
    } catch (actionError) {
      console.error("Error sending action:", actionError);
      return { success: false };
    } finally {
      this.isProcessingAction = false;
    }
  }
}
