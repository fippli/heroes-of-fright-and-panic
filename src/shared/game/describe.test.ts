import { describe, expect, it } from "vitest";
import { describeEvent, eventPositions } from "./describe.ts";
import type { GameEvent } from "./events.ts";

const event = (partial: Partial<GameEvent>): GameEvent => ({
  seq: 1, kind: "action", player: "night", action: null, result: { success: true }, state: null, engineVersion: null, ...partial,
});

describe("describeEvent", () => {
  it("narrates moves and builds with positions", () => {
    expect(describeEvent(event({ action: { type: "move", player: "night", from: { row: 1, column: 2 }, to: { row: 1, column: 3 } } })))
      .toBe("Night moved a piece 1,2 → 1,3");
    expect(describeEvent(event({ player: "day", action: { type: "build", player: "day", buildingType: "house" as never, position: { row: 4, column: 4 } } })))
      .toBe("Day built a house at 4,4");
  });

  it("marks refused actions with the reason", () => {
    expect(describeEvent(event({ action: { type: "pass", player: "night" }, result: { success: false, error: "Not your turn" } })))
      .toBe("Night waited an hour — refused: Not your turn");
  });

  it("handles AI stall notes and creation", () => {
    expect(describeEvent(event({ kind: "ai", action: null, result: { success: false, error: "AI ran out of moves" } }))).toBe("AI ran out of moves");
    expect(describeEvent(event({ kind: "created", player: null }))).toBe("The game began");
  });

  it("lists the positions an action touches", () => {
    expect(eventPositions({ type: "attack", player: "day", attackerPosition: { row: 0, column: 0 }, targetPosition: { row: 0, column: 1 } }))
      .toEqual([{ row: 0, column: 0 }, { row: 0, column: 1 }]);
    expect(eventPositions({ type: "pass", player: "day" })).toEqual([]);
  });
});
