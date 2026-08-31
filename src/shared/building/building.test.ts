import { describe, it, expect } from "vitest";
import {
  buildingCostOf,
  BuildingType,
  createCastleBuilding,
  createChurchBuilding,
  createHouseBuilding,
  createTowerBuilding,
  createWallBuilding,
  isBuildingOwnedBy,
  isBuildingWalkableBy,
} from "./index.ts";

describe("Building", () => {
  describe("costs", () => {
    it("house costs 1 wood", () => {
      const cost = buildingCostOf(BuildingType.house);
      expect(cost.wood).toBe(1);
      expect(cost.stone).toBe(0);
    });

    it("tower costs 10 stone", () => {
      const cost = buildingCostOf(BuildingType.tower);
      expect(cost.stone).toBe(10);
      expect(cost.wood).toBe(0);
    });

    it("wall costs 1 stone", () => {
      const cost = buildingCostOf(BuildingType.wall);
      expect(cost.stone).toBe(1);
    });

    it("church costs 3 wood and 3 stone", () => {
      const cost = buildingCostOf(BuildingType.church);
      expect(cost.wood).toBe(3);
      expect(cost.stone).toBe(3);
    });

    it("castle has no cost (created by king entering tower)", () => {
      const cost = buildingCostOf(BuildingType.castle);
      expect(cost.wood).toBe(0);
      expect(cost.stone).toBe(0);
    });
  });

  describe("view ranges", () => {
    it("house has view range 1", () => {
      expect(createHouseBuilding("day").viewRange).toBe(1);
    });

    it("tower has view range 4", () => {
      expect(createTowerBuilding("day").viewRange).toBe(4);
    });

    it("a keep sees 2, a citadel 4", () => {
      expect(createCastleBuilding("day").viewRange).toBe(2);
      expect(createCastleBuilding("day", 3).viewRange).toBe(4);
    });

    it("wall has view range 0", () => {
      expect(createWallBuilding("day").viewRange).toBe(0);
    });

    it("church has view range 1", () => {
      expect(createChurchBuilding("day").viewRange).toBe(1);
    });
  });

  describe("walkability", () => {
    it("house is walkable by both players", () => {
      const house = createHouseBuilding("day");
      expect(isBuildingWalkableBy(house, "day")).toBe(true);
      expect(isBuildingWalkableBy(house, "night")).toBe(true);
    });

    it("wall is walkable by owner only", () => {
      const wall = createWallBuilding("day");
      expect(isBuildingWalkableBy(wall, "day")).toBe(true);
      expect(isBuildingWalkableBy(wall, "night")).toBe(false);
    });

    it("tower is walkable by both players", () => {
      const tower = createTowerBuilding("day");
      expect(isBuildingWalkableBy(tower, "day")).toBe(true);
      expect(isBuildingWalkableBy(tower, "night")).toBe(true);
    });
  });

  describe("defense", () => {
    it("ordinary buildings have 1 defense; castles grow with their tier", () => {
      expect(createHouseBuilding("day").defense).toBe(1);
      expect(createTowerBuilding("day").defense).toBe(1);
      expect(createWallBuilding("day").defense).toBe(1);
      expect(createChurchBuilding("day").defense).toBe(1);
      expect(createCastleBuilding("day").defense).toBe(2);
      expect(createCastleBuilding("day", 2).defense).toBe(3);
      expect(createCastleBuilding("day", 3).defense).toBe(4);
    });
  });

  describe("ownership", () => {
    it("isOwnedBy returns true for matching player", () => {
      const house = createHouseBuilding("day");
      expect(isBuildingOwnedBy(house, "day")).toBe(true);
      expect(isBuildingOwnedBy(house, "night")).toBe(false);
    });
  });
});
