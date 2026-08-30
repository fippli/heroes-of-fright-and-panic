import { describe, expect, it } from "vitest";
import { createGame } from "./create-game.ts";
import { processAction } from "./actions.ts";
import { diffGames, replayEvents, type GameEvent } from "./events.ts";
import type { Game } from "./types.ts";
import type { GameAction } from "../actions/index.ts";

const baseGame = (): Game => ({
  ...createGame({ boardSize: 12, name: "replay", alliance: "day", creatorEmail: "a@b.c", inviteEmail: null, seed: 5 }),
  id: "g",
  createdAt: new Date(),
  updatedAt: new Date(),
  gameOver: false,
});

const findPiece = (game: Game, kind: string, owner: string) =>
  game.tiles.find((tile) => tile.piece?.kind === kind && tile.piece.owner === owner)!;

describe("replayEvents", () => {
  it("reproduces the stored state from the creation snapshot and actions", () => {
    const game = baseGame();
    const peasant = findPiece(game, "peasant", "day");
    const target = game.tiles.find(
      (t) => t.piece === null && t.landscape?.type === "grass" &&
        Math.abs(t.row - peasant.row) <= 1 && Math.abs(t.column - peasant.column) <= 1 &&
        !(t.row === peasant.row && t.column === peasant.column),
    )!;
    const move: GameAction = { type: "move", player: "day", from: { row: peasant.row, column: peasant.column }, to: { row: target.row, column: target.column } };
    const { result, updatedGame } = processAction({ game, action: move });
    expect(result.success).toBe(true);

    // Simulate the JSON round trip the database imposes
    const events: GameEvent[] = JSON.parse(JSON.stringify([
      { seq: 0, kind: "created", player: null, action: null, result: null, state: game, engineVersion: "t" },
      { seq: 1, kind: "action", player: "day", action: move, result, state: null, engineVersion: "t" },
    ]));

    const report = replayEvents(events);
    expect(report.error).toBeNull();
    expect(report.divergence).toBeNull();
    expect(report.applied).toBe(1);
    const diff = diffGames(report.game!, JSON.parse(JSON.stringify(updatedGame)));
    expect(diff.tiles).toEqual([]);
    expect(diff.clock).toBe(false);
  });

  it("reports the first event whose verdict no longer matches", () => {
    const game = baseGame();
    const king = findPiece(game, "king", "day");
    const illegal: GameAction = { type: "move", player: "day", from: { row: king.row, column: king.column }, to: { row: king.row, column: king.column + 6 } };
    const events: GameEvent[] = [
      { seq: 0, kind: "created", player: null, action: null, result: null, state: game, engineVersion: "t" },
      { seq: 1, kind: "action", player: "day", action: illegal, result: { success: true }, state: null, engineVersion: "t" },
    ];
    const report = replayEvents(events);
    expect(report.divergence?.seq).toBe(1);
    expect(report.divergence?.replayed.success).toBe(false);
  });

  it("fails cleanly without a creation snapshot", () => {
    expect(replayEvents([]).error).toContain("No creation snapshot");
  });
});
