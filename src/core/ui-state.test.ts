import { describe, expect, it } from "vitest";
import { createResourceMap } from "@shared/player/resource-map";
import { costEntries } from "./ui-state";

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
