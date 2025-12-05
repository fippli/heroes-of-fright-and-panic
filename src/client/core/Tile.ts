import type { Building } from "./Building";
import { Hexagon } from "./Hexagon";

import { Landscape, LandscapeType } from "./Landscape";
import type { Piece } from "./Piece";
import type { Player } from "./Player";

export type TilePosition = {
  row: number;
  column: number;
};

export class Tile {
  readonly x: number;
  readonly y: number;
  readonly row: number;
  readonly column: number;
  explored: boolean = false;
  landscape: Landscape | null;
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
    this.getTilesInRange(tiles, viewRange).forEach((_tile: Tile) => {
      // Hexagon.renderArea(ctx, tile.x, tile.y, "#00ffff11");
      // Hexagon.render(ctx, tile.x, tile.y, "#00ffff44");
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

  isSameRow(position: { row: number; column: number }) {
    return this.row === position.row;
  }

  isSameCol(position: { row: number; column: number }) {
    return this.column === position.column;
  }

  isThis(position: { row: number; column: number }) {
    return this.isSameRow(position) && this.isSameCol(position);
  }

  isEastOf(position: { row: number; column: number }) {
    return this.isSameRow(position) && this.column === position.column + 1;
  }

  isWestOf(position: TilePosition) {
    return this.isSameRow(position) && this.column === position.column - 1;
  }

  // Diagonal neighbor rules for odd-r offset hex grid:
  // - Even rows are NOT shifted
  // - Odd rows are shifted RIGHT by half a hex
  // The column offset depends on the SOURCE tile's row (position.row)

  isNorthEastOf(position: TilePosition) {
    // From even row: NE is at (row-1, same col) because odd row above is shifted right
    // From odd row: NE is at (row-1, col+1) because even row above is not shifted
    if (position.row % 2 === 0) {
      return this.row === position.row - 1 && this.column === position.column;
    } else {
      return this.row === position.row - 1 && this.column === position.column + 1;
    }
  }

  isNorthWestOf(position: TilePosition) {
    // From even row: NW is at (row-1, col-1)
    // From odd row: NW is at (row-1, same col)
    if (position.row % 2 === 0) {
      return this.row === position.row - 1 && this.column === position.column - 1;
    } else {
      return this.row === position.row - 1 && this.column === position.column;
    }
  }

  isSouthEastOf(position: TilePosition) {
    // From even row: SE is at (row+1, same col)
    // From odd row: SE is at (row+1, col+1)
    if (position.row % 2 === 0) {
      return this.row === position.row + 1 && this.column === position.column;
    } else {
      return this.row === position.row + 1 && this.column === position.column + 1;
    }
  }

  isSouthWestOf(position: TilePosition) {
    // From even row: SW is at (row+1, col-1)
    // From odd row: SW is at (row+1, same col)
    if (position.row % 2 === 0) {
      return this.row === position.row + 1 && this.column === position.column - 1;
    } else {
      return this.row === position.row + 1 && this.column === position.column;
    }
  }

  isNeighborTo(position: TilePosition | null | undefined) {
    if (!position) return false;

    return (
      this.isEastOf(position) ||
      this.isWestOf(position) ||
      this.isNorthEastOf(position) ||
      this.isNorthWestOf(position) ||
      this.isSouthEastOf(position) ||
      this.isSouthWestOf(position)
    );
  }

  getNeighbors(tiles: Tile[]) {
    return tiles.filter((tile) => tile.isNeighborTo(this));
  }

  /**
   * Get all tiles within a given range using BFS.
   * Range 0 = just this tile, Range 1 = this + 6 neighbors, etc.
   */
  getTilesInRange(tiles: Tile[], viewRange: number): Tile[] {
    const result: Tile[] = [this];
    let currentLayer: Tile[] = [this];

    for (let i = 0; i < viewRange; i++) {
      const nextLayer: Tile[] = [];
      for (const tile of currentLayer) {
        const neighbors = tile.getNeighbors(tiles);
        for (const neighbor of neighbors) {
          // Check if already included using row/column (not reference equality)
          const alreadyIncluded = result.some(
            (r) => r.row === neighbor.row && r.column === neighbor.column,
          );
          if (!alreadyIncluded) {
            result.push(neighbor);
            nextLayer.push(neighbor);
          }
        }
      }
      currentLayer = nextLayer;
    }

    return result;
  }

  hasExploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => t.explored);
  }

  hasUnexploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => !t.explored);
  }

  has(tilePosition: TilePosition) {
    return this.row === tilePosition.row && this.column === tilePosition.column;
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
    const q2 = compareTile.column - Math.floor((compareTile.row - (compareTile.row & 1)) / 2);
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
