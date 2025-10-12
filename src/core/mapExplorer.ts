import { weightedRandom } from "../utils/weightedRandom";
import { Tile } from "./Tile";
import { TileType } from "./TileType";

const grassNeighborTypes = [TileType.TREE, TileType.GRASS, TileType.SAND];

const getGrassNeighbor = (thisTile: Tile, tiles: Tile[]) => {
  // if (thisTile.isNeighborToType(TileType.SAND, tiles)) {
  //   return weightedRandom([TileType.SAND, TileType.TREE], [1, 0.3]);
  // }

  // if (thisTile.isNeighborToType(TileType.WATER, tiles)) {
  //   return TileType.SAND;
  // }

  return weightedRandom(grassNeighborTypes, [1, 0.2, 0.1]);
};

const treeNeighborTypes = [
  TileType.GRASS,
  TileType.TREE,
  TileType.SAND,
  TileType.WATER,
];
const getTreeNeighbor = (thisTile: Tile, tiles: Tile[]) => {
  return weightedRandom(treeNeighborTypes, [0.2, 2, 0.1, 0.1]);
};

const waterNeighborTypes = [TileType.WATER, TileType.SAND];
const getWaterNeighbor = (thisTile: Tile, tiles: Tile[]) => {
  return weightedRandom(waterNeighborTypes, [1, 0.3]);
};

const sandNeighborTypes = [TileType.GRASS, TileType.WATER, TileType.TREE];
const getSandNeighbor = (thisTile: Tile, tiles: Tile[]) => {
  return weightedRandom(sandNeighborTypes, [1, 1, 0.1]);
};

export const mapExplorer = (thisTile: Tile, tiles: Tile[]): TileType => {
  if (thisTile.isNeighborToGrass(tiles)) {
    return getGrassNeighbor(thisTile, tiles);
  }

  if (thisTile.isNeighborToGrass(tiles) && thisTile.isNeighborToSand(tiles)) {
    return TileType.SAND;
  }

  if (thisTile.isNeighborToSand(tiles) && thisTile.isNeighborToWater(tiles)) {
    return getWaterNeighbor(thisTile, tiles);
  }

  if (thisTile.isNeighborToSand(tiles)) {
    return getSandNeighbor(thisTile, tiles);
  }
  if (thisTile.isNeighborToTree(tiles)) {
    return getTreeNeighbor(thisTile, tiles);
  }

  if (thisTile.isNeighborToWater(tiles)) {
    return getWaterNeighbor(thisTile, tiles);
  }

  return TileType.GRASS;
};
