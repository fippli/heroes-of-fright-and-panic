import { describe, expect, it } from "vitest";
import { createGame } from "../game/create-game.ts";
import { generateAllActions, pickAction, playAiPhase } from "./index.ts";

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

describe("playAiPhase", () => {
  it("always hands the turn back, even with nothing to do", () => {
    const game = gameWithoutDayPieces();
    const report = playAiPhase(game, "day", () => 0.5);
    expect(report.game.currentPlayer).toBe("night");
    // With no pieces the only legal action is pass, tick by tick
    expect(report.steps.every((step) => step.action.type === "pass")).toBe(true);
  });

  it("ends the phase with a single pass when nothing can act", () => {
    const game = gameWithoutDayPieces();
    const report = playAiPhase(game, "day", () => 0.5, 3);
    expect(report.game.currentPlayer).toBe("night");
    expect(report.steps.at(-1)?.action.type).toBe("pass");
  });

  it("plays real actions and still ends the phase within the attempt budget", () => {
    const base = gameWithoutDayPieces();
    // Night phase starts at 18:00
    const game = { ...base, clock: { time: 18, hasDawned: true, hasDusked: true }, currentPlayer: "night" as const };
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const report = playAiPhase(game, "night", random, 100);
    expect(report.game.currentPlayer).toBe("day");
    expect(report.steps.length).toBeGreaterThan(0);
  });

});
