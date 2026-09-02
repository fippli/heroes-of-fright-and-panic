import type { RealtimeChannel } from "@supabase/supabase-js";
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
 * Sends actions and watches for state updates: the server broadcasts a poke
 * on the game's realtime channel after every change, and a slow fallback
 * poll covers missed broadcasts (and lets the server resume a stalled AI).
 */
export class GameClient {
  private isProcessingAction: boolean = false;
  private channel: RealtimeChannel | null = null;
  private pollIntervalId: number | null = null;
  private fetchInFlight: boolean = false;
  private refetchQueued: boolean = false;
  /** updated_at of the newest state this client has seen; lets game-state answer "nothing changed" cheaply */
  private lastUpdatedAt: string | null = null;
  private readonly FALLBACK_POLL_MS = 10_000;

  startWatching(
    gameId: string,
    onUpdate: (game: ServerGameState) => void,
    initialUpdatedAt?: string,
  ): void {
    if (this.channel !== null || this.pollIntervalId !== null) return;
    this.noteUpdatedAt(initialUpdatedAt);

    this.channel = supabase
      .channel(`game-${gameId}`)
      .on("broadcast", { event: "updated" }, () => {
        void this.fetchState(gameId, onUpdate);
      })
      .subscribe();

    this.pollIntervalId = window.setInterval(() => {
      void this.fetchState(gameId, onUpdate);
    }, this.FALLBACK_POLL_MS);
  }

  stopWatching(): void {
    if (this.channel !== null) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private async fetchState(
    gameId: string,
    onUpdate: (game: ServerGameState) => void,
  ): Promise<void> {
    if (this.isProcessingAction) return;
    if (this.fetchInFlight) {
      // A poke landed mid-fetch; that fetch may predate the change, so go again
      this.refetchQueued = true;
      return;
    }
    this.fetchInFlight = true;

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("game-state", {
          body: { gameId, since: this.lastUpdatedAt },
        }),
        POLL_TIMEOUT_MS,
        "game-state",
      );
      // An action started while this fetch was in flight; its response is
      // newer than this snapshot, so drop it.
      if (this.isProcessingAction) return;
      if (error === null && data !== null) {
        if ((data as { notModified?: boolean }).notModified === true) return;
        const game = data as ServerGameState;
        this.noteUpdatedAt(game.updatedAt);
        onUpdate(game);
      }
    } catch (fetchError) {
      console.warn("State fetch error:", fetchError);
    } finally {
      this.fetchInFlight = false;
      if (this.refetchQueued) {
        this.refetchQueued = false;
        void this.fetchState(gameId, onUpdate);
      }
    }
  }

  private noteUpdatedAt(updatedAt: string | undefined): void {
    if (typeof updatedAt === "string") this.lastUpdatedAt = updatedAt;
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
      this.noteUpdatedAt(response.game?.updatedAt);
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
