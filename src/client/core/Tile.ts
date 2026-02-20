import * as hex from "@shared/map/hex";
import type { TilePosition } from "@shared/map/tile";
import type { Building } from "./Building";
import { Hexagon } from "./Hexagon";

import { Landscape, LandscapeType } from "./Landscape";
import type { Piece } from "./Piece";
import type { Player } from "./Player";

export type { TilePosition };

export class Tile {
  readonly x: number;
  readonly y: number;
  readonly row: number;
  readonly column: number;
  explored: boolean = false;
  readonly landscape: Landscape | null;
  building?: Building;
  piece?: Piece;

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

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.clip(Hexagon.path(this.x, this.y));

    if (this.explored) {
      if (this.landscape) {
        this.landscape.render(ctx, this);
        this.building?.render(ctx, this);
        this.piece?.render(ctx, this);
      }
    } else {
      Landscape.unexplored(ctx, this.x, this.y);
    }

    ctx.restore();
  }

  giveLandscape(landscape: Landscape) {
    return new Tile({ ...this, landscape: landscape });
  }

  renderArea(ctx: CanvasRenderingContext2D, tiles: Tile[]) {
    ctx.save();
    const viewRange = Math.max(
      this.building?.viewRange ?? 0,
      this.piece?.viewRange ?? 0,
    );
    this.getTilesInRange(tiles, viewRange).forEach((tile: Tile) => {
      // Subtle cyan overlay for view range
      Hexagon.renderArea(ctx, tile.x, tile.y, "#00ffff11");
    });
    ctx.restore();
  }

  /**
   * Render green overlay on tiles this piece can move to,
   * and yellow overlay on tiles this piece can loot
   */
  renderValidMoves(ctx: CanvasRenderingContext2D, tiles: Tile[]) {
    if (!this.piece) return;

    ctx.save();
    const neighbors = this.getNeighbors(tiles);

    neighbors.forEach((tile) => {
      // Check if can loot (yellow)
      if (this.canLoot(tile)) {
        Hexagon.renderArea(ctx, tile.x, tile.y, "#ffff0044");
        Hexagon.render(ctx, tile.x, tile.y, "#ffff0088");
      }
      // Check if can walk (green) - only if no piece there
      else if (this.canWalkOn(tile) && !tile.piece) {
        Hexagon.renderArea(ctx, tile.x, tile.y, "#00ff0044");
        Hexagon.render(ctx, tile.x, tile.y, "#00ff0088");
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
    if (!this.piece || !myPlayerType) return;

    ctx.save();
    // Use attackRange if available, otherwise fall back to viewRange
    const attackRange = this.piece.attackRange ?? this.piece.viewRange ?? 1;
    const tilesInRange = this.getTilesInRange(tiles, attackRange);

    tilesInRange.forEach((tile) => {
      // Check if tile has an enemy piece
      if (tile.piece && tile.piece.owner?.type !== myPlayerType) {
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
    const centerX = this.x; // Center x of the bounding box
    const centerY = this.y; // Center y of the bounding box

    return Hexagon.collidesWithCoordinates(mouseX, mouseY, centerX, centerY);
  }

  explore(tiles: Tile[], player: Player) {
    // this.explored = true;

    if (this.building && this.building.isOwnedBy(player)) {
      this.explored = true;
    }

    if (this.piece && this.piece.isOwnedBy(player)) {
      this.explored = true;

      const viewRange = Math.max(
        this.building?.viewRange ?? 0,
        this.piece?.viewRange ?? 0,
      );
      this.getTilesInRange(tiles, viewRange).forEach((tile) => {
        tile.explored = true;
      });
    }
  }

  unexplore() {
    this.explored = false;
  }

  exploreAs(landscape: Landscape) {
    return new Tile({ ...this, explored: true, landscape: landscape });
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
   */
  getTilesInRange(tiles: Tile[], viewRange: number): Tile[] {
    return Array.from({ length: viewRange }, (_, index) => index).reduce<{
      result: Tile[];
      currentLayer: Tile[];
    }>(
      (acc, _) => {
        const nextLayer = acc.currentLayer.flatMap((tile) =>
          tile.getNeighbors(tiles).filter(
            (neighbor) =>
              !acc.result.some(
                (existing) =>
                  existing.row === neighbor.row &&
                  existing.column === neighbor.column,
              ),
          ),
        );
        return {
          result: [...acc.result, ...nextLayer],
          currentLayer: nextLayer,
        };
      },
      { result: [this], currentLayer: [this] },
    ).result;
  }

  hasExploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => t.explored);
  }

  hasUnexploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => !t.explored);
  }

  has(tilePosition: TilePosition) {
    return hex.isSamePosition(this, tilePosition);
  }

  hasAny(tilePositions: TilePosition[]) {
    return tilePositions.some((tilePosition) => this.has(tilePosition));
  }

  renderOutline(ctx: CanvasRenderingContext2D, tiles: Tile[]) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    this.getNeighbors(tiles).forEach((tile) => {
      Hexagon.render(ctx, tile.x, tile.y, "#00ffff");
    });
    ctx.setLineDash([]);
    ctx.restore();
  }

  build(building: Building) {
    if (this.landscape?.type === LandscapeType.grass) {
      this.building = building;
    }
  }

  place(piece: Piece) {
    this.piece = piece;
  }

  unplace() {
    this.piece = undefined;
  }

  unbuild() {
    this.building = undefined;
  }

  /**
   * Calculate hex distance using axial coordinates.
   * For offset coordinates, we first convert to axial (cube) coordinates.
   */
  distance(compareTile: Tile): number {
    return this.distanceTo(compareTile);
  }

  distanceTo(compareTile: Tile): number {
    // Convert offset coordinates to axial coordinates
    // For odd-r offset: q = col - (row - (row & 1)) / 2, r = row
    const q1 = this.column - Math.floor((this.row - (this.row & 1)) / 2);
    const r1 = this.row;
    const q2 =
      compareTile.column -
      Math.floor((compareTile.row - (compareTile.row & 1)) / 2);
    const r2 = compareTile.row;

    // Hex distance in axial coordinates: (|dq| + |dq + dr| + |dr|) / 2
    const dq = q1 - q2;
    const dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
  }

  inRangeOf(compareTile: Tile) {
    return this.distanceTo(compareTile) <= this.getMaxViewRange();
  }

  getMaxViewRange() {
    return Math.max(this.building?.viewRange ?? 0, this.piece?.viewRange ?? 0);
  }

  canWalkOn(tile: Tile) {
    if (!tile.landscape) return false;
    return (
      this.piece?.walkableLandscape.includes(tile.landscape?.type) ?? false
    );
  }

  canLoot(tile: Tile): boolean {
    if (!tile.landscape) return false;
    if (!tile.landscape.lootDrop) return false;
    return (
      this.piece?.lootableLandscape.includes(tile.landscape?.type) ?? false
    );
  }
}
