import { describe, expect, it } from "vitest";
import { createGame } from "../game/create-game.ts";
import { generateAllActions, pickAction } from "./index.ts";

const gameWithoutDayPieces = () => {
  const game = createGame({ boardSize: 12, name: "ai", alliance: "day", creatorEmail: "a@b.c", inviteEmail: null, seed: 2 });
  return {
    ...game,
    id: "g",
    createdAt: new Date(),
    updatedAt: new Date(),
    gameOver: false,
    tiles: game.tiles.map((tile) => (tile.piece?.owner === "day" ? { ...tile, piece: null } : tile)),
  };
};

describe("generateAllActions", () => {
  it("falls back to pass when the player has no other legal action", () => {
    const actions = generateAllActions(gameWithoutDayPieces(), "day");
    expect(actions).toEqual([{ type: "pass", player: "day" }]);
    expect(pickAction(actions, () => 0.5)?.type).toBe("pass");
  });

  it("does not offer pass while real actions exist", () => {
    const game = { ...gameWithoutDayPieces() };
    const actions = generateAllActions(game, "night");
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((action) => action.type === "pass")).toBe(false);
  });
});
