import { describe, expect, it } from "vitest";
import { createGame } from "@shared/game/create-game";
import { predictAction } from "./predict";
import type { ServerGameState } from "./GameTypes";

const freshGame = (): ServerGameState =>
  ({
    ...createGame({
      boardSize: 12,
      name: "predict",
      alliance: "day",
      creatorEmail: "a@b.c",
      inviteEmail: null,
      seed: 3,
    }),
    id: "g",
    gameOver: false,
  }) as unknown as ServerGameState;

const findPiece = (state: ServerGameState, kind: string, owner: string) =>
  state.tiles.find(
    (tile) => tile.piece?.kind === kind && tile.piece?.owner === (owner as never),
  );

describe("predictAction", () => {
  it("applies a legal move locally: piece relocates and the clock advances", () => {
    const state = freshGame();
    const from = findPiece(state, "peasant", "day");
    expect(from).toBeDefined();
    const target = state.tiles.find(
      (tile) =>
        tile.piece == null &&
        tile.landscape?.type === "grass" &&
        Math.abs(tile.row - from!.row) <= 1 &&
        Math.abs(tile.column - from!.column) <= 1 &&
        !(tile.row === from!.row && tile.column === from!.column),
    );
    expect(target).toBeDefined();

    const predicted = predictAction(state, {
      type: "move",
      player: "day",
      from: { row: from!.row, column: from!.column },
      to: { row: target!.row, column: target!.column },
    });

    expect(predicted).not.toBeNull();
    expect(predicted!.clock.time).toBe(state.clock.time + 1);
    const moved = predicted!.tiles.find(
      (tile) => tile.row === target!.row && tile.column === target!.column,
    );
    expect(moved?.piece?.kind).toBe("peasant");
    // Input state is untouched
    expect(
      state.tiles.find((tile) => tile.row === from!.row && tile.column === from!.column)?.piece?.kind,
    ).toBe("peasant");
  });

  it("returns null for an action the engine rejects", () => {
    const state = freshGame();
    const king = findPiece(state, "king", "day")!;
    const predicted = predictAction(state, {
      type: "move",
      player: "day",
      from: { row: king.row, column: king.column },
      to: { row: king.row, column: king.column + 5 },
    });
    expect(predicted).toBeNull();
  });

  it("returns null when it is not that player's turn", () => {
    const state = freshGame();
    const king = findPiece(state, "king", "night")!;
    const predicted = predictAction(state, {
      type: "move",
      player: "night",
      from: { row: king.row, column: king.column },
      to: { row: king.row, column: king.column - 1 },
    });
    expect(predicted).toBeNull();
  });
});
