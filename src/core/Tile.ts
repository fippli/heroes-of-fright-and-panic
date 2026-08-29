import * as hex from "@shared/map/hex";
import type { TilePosition } from "@shared/map/tile";
import type { ImageAssets } from "../images";
import type { Building } from "./Building";
import { Hexagon } from "./Hexagon";

import { Landscape } from "./Landscape";
import type { Piece } from "./Piece";

export type { TilePosition };

const tileKey = (tile: TilePosition): string => `${tile.row},${tile.column}`;

export class Tile {
  readonly x: number;
  readonly y: number;
  readonly row: number;
  readonly column: number;
  explored: boolean = false;
  readonly landscape: Landscape | null;
  readonly building?: Building;
  readonly piece?: Piece;

  constructor({
    row,
    column,
    explored,
    landscape,
    piece,
    building,
  }: {
    row: number;
    column: number;
    explored?: boolean;
    landscape?: Landscape;
    piece?: Piece;
    building?: Building;
  }) {
    this.piece = piece;
    this.building = building;
    this.x = Hexagon.x(row, column);
    this.y = Hexagon.y(row);
    this.row = row;
    this.column = column;
    this.explored = explored ?? false;
    this.landscape = landscape ?? null;
  }

  render(ctx: CanvasRenderingContext2D, imageAssets: ImageAssets) {
    ctx.save();
    ctx.clip(Hexagon.path(this.x, this.y));

    if (this.explored) {
      if (this.landscape !== null) {
        this.landscape.render(ctx, this, imageAssets);
        this.building?.render(ctx, this, imageAssets);
        this.piece?.render(ctx, this, imageAssets);
      }
    } else {
      Landscape.unexplored(ctx, this.x, this.y, imageAssets);
    }

    ctx.restore();
  }

  renderArea(ctx: CanvasRenderingContext2D, tiles: Tile[]) {
    ctx.save();
    const viewRange = Math.max(
      this.building?.viewRange ?? 0,
      this.piece?.viewRange ?? 0,
    );
    this.getTilesInRange(tiles, viewRange).forEach((tile: Tile) => {
      Hexagon.renderArea(ctx, tile.x, tile.y, "#00ffff11");
    });
    ctx.restore();
  }

  /**
   * Render yellow overlay on tiles this piece can loot
   */
  renderValidMoves(ctx: CanvasRenderingContext2D, tiles: Tile[]) {
    if (this.piece === undefined) return;

    ctx.save();
    const neighbors = this.getNeighbors(tiles);

    // Walkable tiles get no overlay: the green wash hid the map. Only
    // lootable neighbours are marked.
    neighbors.forEach((tile) => {
      if (this.canLoot(tile)) {
        Hexagon.renderArea(ctx, tile.x, tile.y, "#ffff0044");
        Hexagon.render(ctx, tile.x, tile.y, "#ffff0088");
      }
    });
    ctx.restore();
  }

  /**
   * Render red overlay on tiles this piece can attack
   */
  renderValidAttacks(
    ctx: CanvasRenderingContext2D,
    tiles: Tile[],
    myPlayerType: "day" | "night" | null,
  ) {
    if (this.piece === undefined || myPlayerType === null) return;

    ctx.save();
    const attackRange = this.piece.attackRange ?? this.piece.viewRange ?? 1;
    const tilesInRange = this.getTilesInRange(tiles, attackRange);

    tilesInRange.forEach((tile) => {
      if (tile.piece !== undefined && tile.piece.owner?.type !== myPlayerType) {
        Hexagon.renderArea(ctx, tile.x, tile.y, "#ff000044");
        Hexagon.render(ctx, tile.x, tile.y, "#ff0000aa");
      }
    });
    ctx.restore();
  }

  renderHovered(ctx: CanvasRenderingContext2D) {
    ctx.save();
    Hexagon.render(ctx, this.x, this.y, "#ff884488");
    ctx.restore();
  }

  isMouseOver(mouseX: number, mouseY: number) {
    return Hexagon.collidesWithCoordinates(mouseX, mouseY, this.x, this.y);
  }

  isNeighborTo(position: TilePosition | null | undefined) {
    if (position == null) return false;
    return hex.isNeighborTo(this, position);
  }

  getNeighbors(tiles: Tile[]) {
    return hex.findNeighbors(this, tiles);
  }

  /**
   * Get all tiles within a given range using BFS.
   * Range 0 = just this tile, Range 1 = this + 6 neighbors, etc.
   * Uses a Set for O(1) visited-tile lookups instead of linear scans.
   */
  getTilesInRange(tiles: Tile[], viewRange: number): Tile[] {
    return Array.from({ length: viewRange }).reduce<{
      result: Tile[];
      currentLayer: Tile[];
      visited: Set<string>;
    }>(
      (acc) => {
        const nextLayer = acc.currentLayer.flatMap((tile) =>
          tile.getNeighbors(tiles).filter((neighbor) => {
            const key = tileKey(neighbor);
            if (acc.visited.has(key)) return false;
            acc.visited.add(key);
            return true;
          }),
        );
        return {
          result: [...acc.result, ...nextLayer],
          currentLayer: nextLayer,
          visited: acc.visited,
        };
      },
      {
        result: [this],
        currentLayer: [this],
        visited: new Set([tileKey(this)]),
      },
    ).result;
  }

  has(tilePosition: TilePosition) {
    return hex.isSamePosition(this, tilePosition);
  }

  distanceTo(compareTile: Tile): number {
    const q1 = this.column - Math.floor((this.row - (this.row & 1)) / 2);
    const r1 = this.row;
    const q2 =
      compareTile.column -
      Math.floor((compareTile.row - (compareTile.row & 1)) / 2);
    const r2 = compareTile.row;

    const dq = q1 - q2;
    const dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
  }

  canWalkOn(tile: Tile) {
    if (tile.landscape === null) return false;
    return this.piece?.walkableLandscape.includes(tile.landscape.type) ?? false;
  }

  canLoot(tile: Tile): boolean {
    if (this.piece === undefined) return false;
    return tile.landscape?.lootDrop !== undefined && this.isNeighborTo(tile);
  }
}
