import type { Building } from "./Building";
import { Hexagon } from "./Hexagon";

import { Landscape, LandscapeType } from "./Landscape";
import type { Piece } from "./Piece";
import type { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";

export type TilePosition = {
  row: number;
  col: number;
};

export class Tile {
  readonly x: number;
  readonly y: number;
  readonly row: number;
  readonly col: number;
  explored: boolean = false;
  landscape: Landscape | null;
  building?: Building;
  piece?: Piece;

  constructor({
    row,
    col,
    explored,
    landscape,
    piece,
    building,
  }: {
    row: number;
    col: number;
    explored?: boolean;
    landscape?: Landscape;
    piece?: Piece;
    building?: Building;
  }) {
    this.piece = piece;
    this.building = building;
    this.x = Hexagon.x(row, col);
    this.y = Hexagon.y(row);
    this.row = row;
    this.col = col;
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
    this.getTilesInRange(tiles, viewRange).forEach((tile) => {
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

  isSameRow(position: { row: number; col: number }) {
    return this.row === position.row;
  }

  isSameCol(position: { row: number; col: number }) {
    return this.col === position.col;
  }

  isThis(position: { row: number; col: number }) {
    return this.isSameRow(position) && this.isSameCol(position);
  }

  isEastOf(position: { row: number; col: number }) {
    return this.isSameRow(position) && this.col === position.col + 1;
  }

  isWestOf(position: TilePosition) {
    return this.isSameRow(position) && this.col === position.col - 1;
  }

  isNorthEastOf(position: TilePosition) {
    if (position.row % 2 === 0) {
      return this.row === position.row - 1 && this.col === position.col;
    } else {
      return this.row === position.row - 1 && this.col === position.col + 1;
    }
  }

  isNorthWestOf(position: TilePosition) {
    if (position.row % 2 === 0) {
      return this.row === position.row - 1 && this.col === position.col - 1;
    } else {
      return this.row === position.row - 1 && this.col === position.col;
    }
  }

  isSouthEastOf(position: TilePosition) {
    if (position.row % 2 === 0) {
      return this.row === position.row + 1 && this.col === position.col;
    } else {
      return this.row === position.row + 1 && this.col === position.col + 1;
    }
  }

  isSouthWestOf(position: TilePosition) {
    if (position.row % 2 === 0) {
      return this.row === position.row + 1 && this.col === position.col - 1;
    } else {
      return this.row === position.row + 1 && this.col === position.col;
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

  getTilesInRange(
    tiles: Tile[],
    viewRange: number,
    layer: number = 1,
    neighbors: Tile[] = [this],
  ): Tile[] {
    if (layer > viewRange) {
      return neighbors;
    }

    const nextNeighbors = neighbors.flatMap((neighbor) => {
      return neighbor.getNeighbors(tiles);
    });

    return this.getTilesInRange(tiles, viewRange, layer + 1, [
      ...new Set<Tile>(nextNeighbors),
    ]);
  }

  hasExploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => t.explored);
  }

  hasUnexploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => !t.explored);
  }

  has(tilePosition: TilePosition) {
    return this.row === tilePosition.row && this.col === tilePosition.col;
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

  walkable() {
    return this.building?.walkable || this.landscape?.walkable;
  }

  distance(compareTile: Tile) {
    return Math.abs(this.row - compareTile.row + (this.col - compareTile.col));
  }

  distanceTo(compareTile: Tile) {
    return Math.abs(this.row - compareTile.row + (this.col - compareTile.col));
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

  canLoot(tile: Tile) {
    if (!tile.landscape) return false;
    if (!tile.landscape.lootDrop) return false;
    return (
      this.piece?.lootableLandscape.includes(tile.landscape?.type) ?? false
    );
  }

  loot() {
    if (!this.landscape)
      return { lootDrop: new ResourceMap({}), nextLandscape: this.landscape };
    return this.landscape.loot();
  }
}
