import { BuildingType } from "@shared/building/index.ts";
import * as hex from "@shared/map/hex.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import { PieceKind } from "@shared/piece/index.ts";
import { createResourceMap, addResources, type ResourceMap } from "@shared/player/resource-map.ts";
import type { Research } from "@shared/research/index.ts";

/**
 * Calculate total resource production for a player.
 *
 * Production sources:
 * - House: produces from adjacent terrain tiles
 *   - Farm → +1 food (always)
 *   - Tree → +1 wood (always; forests are worked from the house)
 *   - Mountain → +1 stone (+ iron with Mining II, + gold with Mining III)
 * - Church with priest: +1 faith per praying priest
 * - Boat with peasant surrounded by water: +1 food (fishing)
 *
 * Each terrain tile produces once per cycle regardless of how many houses are adjacent.
 */
export const calculateProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
  research: Research,
): ResourceMap => {
  const houseProduction = calculateHouseProduction(playerType, tiles, research);
  const churchProduction = calculateChurchProduction(playerType, tiles);
  const fishingProduction = calculateFishingProduction(playerType, tiles);

  return addResources(addResources(houseProduction, churchProduction), fishingProduction);
};

const calculateHouseProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
  research: Research,
): ResourceMap => {
  const houses = tiles.filter(
    (tile) =>
      tile.building?.type === BuildingType.house &&
      tile.building.owner === playerType,
  );

  // Track which tiles have already produced (each tile produces once)
  const producedTileKeys = new Set<string>();

  return houses.reduce((total, houseTile) => {
    const neighbors = hex.findNeighbors(houseTile, tiles as Tile[]);
    return neighbors.reduce((acc, neighbor) => {
      const tileKey = `${neighbor.row},${neighbor.column}`;
      if (producedTileKeys.has(tileKey)) {
        return acc;
      }
      const production = tileProduction(neighbor, research);
      if (production !== null) {
        producedTileKeys.add(tileKey);
        return addResources(acc, production);
      }
      return acc;
    }, total);
  }, createResourceMap({}));
};

const tileProduction = (
  tile: Tile,
  research: Research,
): ResourceMap | null => {
  if (tile.landscape === null) {
    return null;
  }
  switch (tile.landscape.type) {
    case LandscapeType.farm:
      return createResourceMap({ food: 1 });
    case LandscapeType.tree:
      return createResourceMap({ wood: 1 });
    case LandscapeType.mountain:
      return createResourceMap({
        stone: 1,
        iron: research.hasMiningII ? 1 : 0,
        gold: research.hasMiningIII ? 1 : 0,
      });
    default:
      return null;
  }
};

const calculateChurchProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
): ResourceMap => {
  const churchesWithPriests = tiles.filter(
    (tile) =>
      tile.building?.type === BuildingType.church &&
      tile.building.owner === playerType &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.priest &&
      tile.piece.owner === playerType,
  );

  return createResourceMap({ faith: churchesWithPriests.length });
};

const calculateFishingProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
): ResourceMap => {
  const boatTilesWithPeasants = tiles.filter(
    (tile) =>
      tile.landscape?.type === LandscapeType.water &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.peasant &&
      tile.piece.owner === playerType &&
      tile.piece.steed?.type === "boat",
  );

  const fishingBoats = boatTilesWithPeasants.filter((boatTile) => {
    const neighbors = hex.findNeighbors(boatTile, tiles as Tile[]);
    return neighbors.every(
      (neighbor) => neighbor.landscape?.type === LandscapeType.water,
    );
  });

  return createResourceMap({ food: fishingBoats.length });
};

/**
 * Count the number of priests praying in churches for a player.
 * Used for arch angel summoning requirement (needs 10).
 */
export const countPrayingPriests = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
): number => {
  return tiles.filter(
    (tile) =>
      tile.building?.type === BuildingType.church &&
      tile.building.owner === playerType &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.priest &&
      tile.piece.owner === playerType,
  ).length;
};
