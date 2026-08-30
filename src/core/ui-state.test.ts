import { describe, expect, it } from "vitest";
import { createResourceMap } from "@shared/player/resource-map";
import { costEntries, formatClock, phaseOf } from "./ui-state";

describe("costEntries", () => {
  it("lists only non-zero resources in display order", () => {
    expect(costEntries(createResourceMap({ stone: 3, wood: 3 }))).toEqual([
      { resource: "wood", amount: 3 },
      { resource: "stone", amount: 3 },
    ]);
  });

  it("is empty for a free cost", () => {
    expect(costEntries(createResourceMap({}))).toEqual([]);
  });

  it("includes iron and faith", () => {
    expect(costEntries(createResourceMap({ iron: 1, faith: 100 }))).toEqual([
      { resource: "iron", amount: 1 },
      { resource: "faith", amount: 100 },
    ]);
  });
});

describe("formatClock", () => {
  it("prints whole and fractional hours as HH:MM", () => {
    expect(formatClock(6)).toBe("06:00");
    expect(formatClock(6.5)).toBe("06:30");
    expect(formatClock(23.75)).toBe("23:45");
  });
});

describe("phaseOf", () => {
  it("counts hours left in the day phase", () => {
    expect(phaseOf(6)).toEqual({ isDay: true, hoursLeft: 12, progress: 0 });
    expect(phaseOf(15)).toEqual({ isDay: true, hoursLeft: 3, progress: 0.75 });
  });

  it("wraps the night phase across midnight", () => {
    expect(phaseOf(18)).toEqual({ isDay: false, hoursLeft: 12, progress: 0 });
    expect(phaseOf(2)).toEqual({ isDay: false, hoursLeft: 4, progress: 8 / 12 });
  });
});
