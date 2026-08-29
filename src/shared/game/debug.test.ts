import { describe, expect, it } from "vitest";
import { createGame } from "./create-game.ts";
import { playerRole, redactGame, summarizeGame, AI_EMAIL } from "./debug.ts";

const game = {
  ...createGame({
    boardSize: 12,
    name: "debug test",
    alliance: "day",
    creatorEmail: "creator@example.com",
    inviteEmail: AI_EMAIL,
    seed: 7,
  }),
  id: "g-1",
  createdAt: new Date("2026-08-28T10:00:00Z"),
  updatedAt: new Date("2026-08-28T11:00:00Z"),
  gameOver: false,
};

describe("playerRole", () => {
  it("maps emails to seat roles without exposing them", () => {
    expect(playerRole("someone@example.com")).toBe("human");
    expect(playerRole(AI_EMAIL)).toBe("ai");
    expect(playerRole(null)).toBe("open");
    expect(playerRole(undefined)).toBe("open");
    expect(playerRole("")).toBe("open");
  });
});

describe("redactGame", () => {
  it("removes every email field and keeps the rest", () => {
    const redacted = redactGame(game);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("@");
    expect(redacted).not.toHaveProperty("creatorEmail");
    expect(redacted).not.toHaveProperty("dayPlayerEmail");
    expect(redacted).not.toHaveProperty("nightPlayerEmail");
    expect(redacted).not.toHaveProperty("invitedEmail");
    expect(redacted.dayPlayerRole).toBe("human");
    expect(redacted.nightPlayerRole).toBe("ai");
    expect(redacted.hasInvite).toBe(true);
    expect(redacted.tiles).toBe(game.tiles);
  });
});

describe("summarizeGame", () => {
  it("lists each player's pieces with positions", () => {
    const summary = summarizeGame(game);
    expect(summary.pieces.day.map((piece) => piece.kind).sort()).toEqual(["king", "peasant"]);
    expect(summary.pieces.night.map((piece) => piece.kind).sort()).toEqual(["king", "peasant"]);
    expect(summary.tileCount).toBe(game.tiles.length);
    expect(JSON.stringify(summary)).not.toContain("@");
  });
});
