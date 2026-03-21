import { describe, it, expect } from "vitest";
import { Building, BuildingType } from "./index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";

describe("Building", () => {
  describe("costs", () => {
    it("house costs 1 wood", () => {
      const cost = Building.costOf(BuildingType.house);
      expect(cost.wood).toBe(1);
      expect(cost.stone).toBe(0);
    });

    it("tower costs 10 stone", () => {
      const cost = Building.costOf(BuildingType.tower);
      expect(cost.stone).toBe(10);
      expect(cost.wood).toBe(0);
    });

    it("wall costs 1 stone", () => {
      const cost = Building.costOf(BuildingType.wall);
      expect(cost.stone).toBe(1);
    });

    it("church costs 3 wood and 3 stone", () => {
      const cost = Building.costOf(BuildingType.church);
      expect(cost.wood).toBe(3);
      expect(cost.stone).toBe(3);
    });

    it("castle has no cost (created by king entering tower)", () => {
      const cost = Building.costOf(BuildingType.castle);
      expect(cost.wood).toBe(0);
      expect(cost.stone).toBe(0);
    });
  });

  describe("view ranges", () => {
    it("house has view range 1", () => {
      expect(Building.house("day").viewRange).toBe(1);
    });

    it("tower has view range 4", () => {
      expect(Building.tower("day").viewRange).toBe(4);
    });

    it("castle has view range 3", () => {
      expect(Building.castle("day").viewRange).toBe(3);
    });

    it("wall has view range 0", () => {
      expect(Building.wall("day").viewRange).toBe(0);
    });

    it("church has view range 1", () => {
      expect(Building.church("day").viewRange).toBe(1);
    });
  });

  describe("walkability", () => {
    it("house is walkable by both players", () => {
      const house = Building.house("day");
      expect(house.isWalkableBy("day")).toBe(true);
      expect(house.isWalkableBy("night")).toBe(true);
    });

    it("wall is walkable by owner only", () => {
      const wall = Building.wall("day");
      expect(wall.isWalkableBy("day")).toBe(true);
      expect(wall.isWalkableBy("night")).toBe(false);
    });

    it("tower is walkable by both players", () => {
      const tower = Building.tower("day");
      expect(tower.isWalkableBy("day")).toBe(true);
      expect(tower.isWalkableBy("night")).toBe(true);
    });
  });

  describe("defense", () => {
    it("all buildings have 1 defense", () => {
      expect(Building.house("day").defense).toBe(1);
      expect(Building.tower("day").defense).toBe(1);
      expect(Building.castle("day").defense).toBe(1);
      expect(Building.wall("day").defense).toBe(1);
      expect(Building.church("day").defense).toBe(1);
    });
  });

  describe("ownership", () => {
    it("isOwnedBy returns true for matching player", () => {
      const house = Building.house("day");
      expect(house.isOwnedBy("day")).toBe(true);
      expect(house.isOwnedBy("night")).toBe(false);
    });
  });
});
