/**
 * Population: peasants need somewhere to live. Each house offers one slot,
 * plus one per upgrade level (house 1, homestead 2, manor 3).
 */
import { BuildingType, buildingLevel } from "../building/index.ts";
import type { Tile } from "../map/tile.ts";
import { PieceKind, type PlayerType } from "../piece/index.ts";

export type Population = {
  readonly peasants: number;
  readonly capacity: number;
};

export const populationOf = (tiles: ReadonlyArray<Tile>, player: PlayerType): Population => {
  let peasants = 0;
  let capacity = 0;
  tiles.forEach((tile) => {
    if (tile.piece !== null && tile.piece !== undefined && tile.piece.kind === PieceKind.peasant && tile.piece.owner === player) {
      peasants += 1;
    }
    if (tile.building !== null && tile.building !== undefined && tile.building.type === BuildingType.house && tile.building.owner === player) {
      capacity += buildingLevel(tile.building);
    }
  });
  return { peasants, capacity };
};

export const hasRoomForPeasant = (tiles: ReadonlyArray<Tile>, player: PlayerType): boolean => {
  const { peasants, capacity } = populationOf(tiles, player);
  return peasants < capacity;
};
