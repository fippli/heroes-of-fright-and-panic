/**
 * Movement engine — handles all movement-related logic:
 * - Walkability rules (terrain + equipment + steed)
 * - Pathfinding (BFS distance with terrain filtering)
 * - Move range validation
 * - Building walkability
 * - Steed mounting during movement
 */

import type { TilePosition } from "@shared/actions/index.ts";
import { isBuildingWalkableBy } from "@shared/building/index.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";
import { findTile, findNeighborTiles } from "@shared/tile/index.ts";
import type { PlayerType, Piece } from "@shared/piece/index.ts";
import {
  getPieceMove,
  getWalkableLandscape,
  pieceWithSteed,
} from "@shared/piece/index.ts";

// ============================================
// WALKABILITY
// ============================================

/**
 * Check if a piece can walk on a given tile.
 * Considers terrain type, equipment (bow → trees), and steed (boat → water).
 */
export const canWalkOnTile = (
  piece: Piece,
  tile: Tile,
  player: PlayerType,
): boolean => {
  if (tile.landscape === null) return false;
  if (!getWalkableLandscape(piece).includes(tile.landscape.type)) return false;
  if (tile.building !== null && !isBuildingWalkableBy(tile.building, player)) return false;
  return true;
};

/**
 * Check if a tile is passable during pathfinding (must be walkable and unoccupied).
 */
export const isPassable = (
  piece: Piece,
  tile: Tile,
  player: PlayerType,
): boolean => {
  if (tile.piece !== null) return false;
  return canWalkOnTile(piece, tile, player);
};

// ============================================
// PATHFINDING
// ============================================

/**
 * BFS distance from one tile to another, respecting walkable terrain
 * and piece movement range. Returns null if no path exists.
 */
export const findDistance = (
  tiles: ReadonlyArray<Tile>,
  from: TilePosition,
  to: TilePosition,
  piece: Piece,
): number | null => {
  if (from.row === to.row && from.column === to.column) {
    return 0;
  }

  const moveRange = getPieceMove(piece);
  const visited = new Set<string>();
  visited.add(`${from.row},${from.column}`);
  const frontier: ReadonlyArray<{ readonly position: TilePosition; readonly distance: number }> = [
    { position: from, distance: 0 },
  ];

  const search = (
    remaining: ReadonlyArray<{ readonly position: TilePosition; readonly distance: number }>,
  ): number | null => {
    if (remaining.length === 0) return null;

    const [current, ...rest] = remaining;
    if (current.distance >= moveRange) {
      return search(rest);
    }

    const neighbors = findNeighborTiles(tiles, current.position);

    const reachableNeighbor = neighbors.find(
      (neighbor) =>
        neighbor.row === to.row && neighbor.column === to.column,
    );
    if (reachableNeighbor !== undefined) {
      return current.distance + 1;
    }

    const newFrontier = neighbors
      .filter((neighbor) => {
        const key = `${neighbor.row},${neighbor.column}`;
        if (visited.has(key)) return false;
        if (neighbor.piece !== null) return false;
        if (
          neighbor.landscape === null ||
          !getWalkableLandscape(piece).includes(neighbor.landscape.type)
        ) {
          return false;
        }
        visited.add(key);
        return true;
      })
      .map((neighbor) => ({
        position: { row: neighbor.row, column: neighbor.column },
        distance: current.distance + 1,
      }));

    return search([...rest, ...newFrontier]);
  };

  return search(frontier);
};

// ============================================
// MOVE VALIDATION
// ============================================

type MoveValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly error: string };

/**
 * Validate whether a piece can move from one tile to another.
 * Checks ownership, terrain, occupancy, and movement range.
 */
export const validateMove = (
  tiles: ReadonlyArray<Tile>,
  from: TilePosition,
  to: TilePosition,
  player: PlayerType,
): MoveValidation => {
  const fromTile = findTile(tiles, from);
  const toTile = findTile(tiles, to);

  if (fromTile === undefined || toTile === undefined) {
    return { valid: false, error: "Invalid tile position" };
  }

  if (fromTile.piece === null || fromTile.piece.owner !== player) {
    return { valid: false, error: "No piece to move or not your piece" };
  }

  if (toTile.piece !== null) {
    return { valid: false, error: "Target tile is occupied" };
  }

  if (!canWalkOnTile(fromTile.piece, toTile, player)) {
    return { valid: false, error: "Cannot walk on this terrain" };
  }

  const distance = findDistance(tiles, from, to, fromTile.piece);
  if (distance === null || distance > getPieceMove(fromTile.piece)) {
    return { valid: false, error: "Target is out of move range" };
  }

  return { valid: true };
};

// ============================================
// MOVE EXECUTION
// ============================================

/**
 * Execute a move: relocate piece from one tile to another.
 * Handles steed mounting if the destination tile has a steed.
 * Returns the updated tiles array.
 */
export const executeMove = (
  tiles: ReadonlyArray<Tile>,
  from: TilePosition,
  to: TilePosition,
): ReadonlyArray<Tile> => {
  const fromTile = findTile(tiles, from);
  const toTile = findTile(tiles, to);

  if (fromTile === undefined || toTile === undefined || fromTile.piece === null) {
    return tiles;
  }

  const movedPiece = (() => {
    if (
      toTile.steed !== undefined &&
      toTile.steed !== null &&
      fromTile.piece !== null &&
      fromTile.piece.canMountSteed &&
      fromTile.piece.steed === null
    ) {
      return pieceWithSteed(fromTile.piece, toTile.steed);
    }
    return fromTile.piece;
  })();

  return tiles
    .map((tile) =>
      tile.row === fromTile.row && tile.column === fromTile.column
        ? { ...tile, piece: null }
        : tile,
    )
    .map((tile) =>
      tile.row === toTile.row && tile.column === toTile.column
        ? { ...tile, piece: movedPiece, steed: undefined }
        : tile,
    );
};

// ============================================
// CONNECTIVITY
// ============================================

const BASE_WALKABLE_TYPES: ReadonlyArray<LandscapeType> = [
  LandscapeType.grass,
  LandscapeType.sand,
  LandscapeType.farm,
];

/**
 * Check if a walkable path exists between two positions on the map.
 * Uses BFS on base walkable terrain (grass, sand, farm) — does not
 * require equipment or steeds. Used to validate map connectivity
 * between starting positions.
 */
export const hasWalkablePath = (
  tiles: ReadonlyArray<Tile>,
  from: TilePosition,
  to: TilePosition,
): boolean => {
  const visited = new Set<string>();
  visited.add(`${from.row},${from.column}`);

  const search = (frontier: ReadonlyArray<TilePosition>): boolean => {
    if (frontier.length === 0) return false;

    const reached = frontier.some(
      (position) => position.row === to.row && position.column === to.column,
    );
    if (reached) return true;

    const nextFrontier = frontier.flatMap((position) =>
      findNeighborTiles(tiles, position)
        .filter((neighbor) => {
          const key = `${neighbor.row},${neighbor.column}`;
          if (visited.has(key)) return false;
          if (neighbor.landscape === null) return false;
          if (!BASE_WALKABLE_TYPES.includes(neighbor.landscape.type)) return false;
          visited.add(key);
          return true;
        })
        .map((neighbor) => ({ row: neighbor.row, column: neighbor.column })),
    );

    return search(nextFrontier);
  };

  return search([from]);
};
