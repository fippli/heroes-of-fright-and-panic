import { describe, it, expect } from "vitest";
import { createResourceMap, addResources, subtractResources, canAfford } from "./resource-map.ts";

describe("ResourceMap", () => {
  it("creates with default zero values", () => {
    const resources = createResourceMap();
    expect(resources.wood).toBe(0);
    expect(resources.stone).toBe(0);
    expect(resources.iron).toBe(0);
    expect(resources.gold).toBe(0);
    expect(resources.food).toBe(0);
    expect(resources.faith).toBe(0);
  });

  it("creates with specified values", () => {
    const resources = createResourceMap({ wood: 5, stone: 2, iron: 3, gold: 1, food: 10, faith: 7 });
    expect(resources.wood).toBe(5);
    expect(resources.stone).toBe(2);
    expect(resources.iron).toBe(3);
    expect(resources.gold).toBe(1);
    expect(resources.food).toBe(10);
    expect(resources.faith).toBe(7);
  });

  it("adds two resource maps without mutating originals", () => {
    const base = createResourceMap({ wood: 5, stone: 2 });
    const loot = createResourceMap({ wood: 3, iron: 1 });
    const result = addResources(base, loot);

    expect(result.wood).toBe(8);
    expect(result.stone).toBe(2);
    expect(result.iron).toBe(1);
    expect(base.wood).toBe(5);
  });

  it("subtracts two resource maps without mutating originals", () => {
    const base = createResourceMap({ wood: 5, stone: 3 });
    const cost = createResourceMap({ wood: 2, stone: 1 });
    const result = subtractResources(base, cost);

    expect(result.wood).toBe(3);
    expect(result.stone).toBe(2);
    expect(base.wood).toBe(5);
  });

  it("canAfford returns true when resources are sufficient", () => {
    const resources = createResourceMap({ wood: 5, stone: 3, iron: 1 });
    const cost = createResourceMap({ wood: 3, stone: 2 });
    expect(canAfford(resources, cost)).toBe(true);
  });

  it("canAfford returns false when any resource is insufficient", () => {
    const resources = createResourceMap({ wood: 1, stone: 3 });
    const cost = createResourceMap({ wood: 3, stone: 2 });
    expect(canAfford(resources, cost)).toBe(false);
  });

  it("canAfford checks all six resource types", () => {
    const resources = createResourceMap({ wood: 10, stone: 10, iron: 10, gold: 10, food: 10, faith: 0 });
    const cost = createResourceMap({ faith: 1 });
    expect(canAfford(resources, cost)).toBe(false);
  });

  it("subtract can produce negative values", () => {
    const resources = createResourceMap({ wood: 1 });
    const cost = createResourceMap({ wood: 5 });
    const result = subtractResources(resources, cost);
    expect(result.wood).toBe(-4);
  });
});
