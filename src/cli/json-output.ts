import type { ActionResult } from "@shared/actions/index.ts";
import type { Game } from "@shared/game/types.ts";

export const formatJsonResponse = (
  game: Game,
  result?: ActionResult,
): string =>
  JSON.stringify({
    success: result?.success ?? true,
    error: result?.error,
    message: result?.message,
    currentPlayer: game.currentPlayer,
    clock: game.clock.time,
    gameOver: game.gameOver,
    winner: game.winner ?? null,
    dayResources: game.dayPlayer.resources,
    nightResources: game.nightPlayer.resources,
    tiles: game.tiles.map((tile) => ({
      row: tile.row,
      column: tile.column,
      landscape: tile.landscape?.type ?? null,
      piece:
        tile.piece !== null
          ? { kind: tile.piece.kind, owner: tile.piece.owner }
          : null,
      building:
        tile.building !== null
          ? { type: tile.building.type, owner: tile.building.owner }
          : null,
    })),
  });
