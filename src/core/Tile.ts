import { Hexagon } from "./Hexagon";

import { Landscape } from "./Landscape";

const TileLayerCache = new Map<string, HTMLCanvasElement>();

export type TilePosition = {
  row: number;
  col: number;
};

export class Tile {
  x: number;
  y: number;
  readonly row: number;
  readonly col: number;
  explored: boolean = false;
  landscape: Landscape | null;

  constructor({
    row,
    col,
    explored,
    landscape,
  }: {
    row: number;
    col: number;
    explored?: boolean;
    landscape: Landscape | null;
  }) {
    this.x = Hexagon.x(row, col);
    this.y = Hexagon.y(row);
    this.row = row;
    this.col = col;
    this.explored = explored ?? false;
    this.landscape = landscape;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const centerX = this.x;
    const centerY = this.y;
    ctx.clip(Hexagon.path(centerX, centerY));

    if (this.explored) {
      if (this.landscape) {
        this.landscape.render(ctx, this.x, this.y);
      }
    } else {
      Landscape.unexplored(ctx, this.x, this.y);
    }

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

  explore(tiles: Tile[]) {
    if (!this.explored) {
      this.explored = true;
      const neighbors = this.getNeighbors(tiles);

      return this.exploreAs(Landscape.generate(neighbors));
    }
    return this;
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

  isNeighborTo(position: TilePosition) {
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

  hasExploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => t.explored);
  }

  hasUnexploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => !t.explored);
  }

  has(tilePosition: TilePosition) {
    return this.row === tilePosition.row && this.col === tilePosition.col;
  }
}
