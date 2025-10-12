import { Hexagon } from "./Hexagon";
import { TileImage } from "./TileImage";

import grassSrc from "../assets/grass.png";
import houseSrc from "../assets/house.png";
import sandSrc from "../assets/sand.png";
import treeSrc from "../assets/tree.png";
import unesploredSrc from "../assets/unexplored.png";
import vegetationSrc from "../assets/vegetation.png";
import waterSrc from "../assets/water.png";

import { mapExplorer } from "./mapExplorer";
import { TileType } from "./TileType";
import { Landscape } from "./Landscape";
import { Building } from "./Building";
import { Piece } from "./Piece";
import { EmptyRender } from "./EmptyRender";

const radius = 2 * 3 * 5;

const tileWidth = Hexagon.height;
const tileHeight = Hexagon.height;

const unexploredImage = new TileImage(unesploredSrc, tileWidth, tileHeight);
const grassImage = new TileImage(grassSrc, tileWidth, tileWidth);
const treeImage = new TileImage(treeSrc, tileWidth, tileWidth);
const vegetationImage = new TileImage(vegetationSrc, tileWidth, tileWidth);
const houseImage = new TileImage(houseSrc, tileWidth, tileWidth);
const sandImage = new TileImage(sandSrc, tileWidth, tileWidth);
const waterImage = new TileImage(waterSrc, tileWidth, tileWidth);

export enum TileBuilding {
  HOUSE = "house",
}

export class Tile {
  x: number;
  y: number;
  row: number;
  col: number;
  radius: number = radius;
  explored: boolean = false;

  constructor({
    row,
    col,
    explored,
  }: {
    row: number;
    col: number;
    explored?: boolean;
  }) {
    this.x = Hexagon.x(row, col);
    this.y = Hexagon.y(row);
    this.row = row;
    this.col = col;
    this.explored = explored ?? false;
  }

  render(
    ctx: CanvasRenderingContext2D,
    {
      landscape,
      building,
      piece,
    }: {
      landscape: Landscape | EmptyRender;
      building: Building | EmptyRender;
      piece: Piece | EmptyRender;
    },
  ) {
    ctx.save();

    landscape.render(ctx);
    building.render(ctx);
    piece.render(ctx);

    // Draw hexagon
    // const centerX = this.x;
    // const centerY = this.y;

    // Hexagon.render(ctx, centerX, centerY, this.isMouseOver(mouseX, mouseY));
    // ctx.clip();

    // this.tileImage().render(ctx, this.x, this.y);

    // Hexagon.debug(ctx, centerX, centerY);

    //   if (this.isMouseOver(mouseX, mouseY)) {
    //     ctx.strokeStyle = "#ffffff";
    //     ctx.lineWidth = 5;
    //     // draw a line from the center to the mouse
    //     ctx.beginPath();
    //     ctx.moveTo(centerX, centerY);
    //     ctx.lineTo(mouseX, mouseY);
    //     ctx.stroke();
    //   }
    ctx.restore();
  }

  isMouseOver(mouseX: number, mouseY: number) {
    const centerX = this.x; // Center x of the bounding box
    const centerY = this.y; // Center y of the bounding box

    return Hexagon.collidesWithCoordinates(mouseX, mouseY, centerX, centerY);
  }

  explore(tiles: Tile[]) {
    if (!this.explored) {
      const tileType = mapExplorer(this, tiles);
      return new Tile({ ...this, explored: true, type: tileType });
    }

    return this;
  }

  exploreAs(type: TileType) {
    return new Tile({ ...this, explored: true, type });
  }

  // tileImage() {
  //   if (this.explored) {
  //     switch (this.type) {
  //       case TileType.TREE: {
  //         return treeImage;
  //       }

  //       case TileType.VEGETATION: {
  //         return vegetationImage;
  //       }

  //       case TileType.SAND: {
  //         return sandImage;
  //       }

  //       case TileType.WATER: {
  //         return waterImage;
  //       }

  //       default: {
  //         return grassImage;
  //       }
  //     }
  //   }

  //   return unexploredImage;
  // }

  // placeBuilding(building: TileBuilding) {
  //   switch (building) {
  //     case TileBuilding.HOUSE: {
  //       this.building = houseImage;
  //       return this;
  //     }
  //     default: {
  //       this.building = null;
  //       return this;
  //     }
  //   }
  // }

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

  isWestOf(position: { row: number; col: number }) {
    return this.isSameRow(position) && this.col === position.col - 1;
  }

  isNorthEastOf(position: { row: number; col: number }) {
    if (position.row % 2 === 0) {
      return this.row === position.row - 1 && this.col === position.col;
    } else {
      return this.row === position.row - 1 && this.col === position.col + 1;
    }
  }

  isNorthWestOf(position: { row: number; col: number }) {
    if (position.row % 2 === 0) {
      return this.row === position.row - 1 && this.col === position.col - 1;
    } else {
      return this.row === position.row - 1 && this.col === position.col;
    }
  }

  isSouthEastOf(position: { row: number; col: number }) {
    if (position.row % 2 === 0) {
      return this.row === position.row + 1 && this.col === position.col;
    } else {
      return this.row === position.row + 1 && this.col === position.col + 1;
    }
  }

  isSouthWestOf(position: { row: number; col: number }) {
    if (position.row % 2 === 0) {
      return this.row === position.row + 1 && this.col === position.col - 1;
    } else {
      return this.row === position.row + 1 && this.col === position.col;
    }
  }

  isNeighborTo(position: { row: number; col: number }) {
    return (
      this.isEastOf(position) ||
      this.isWestOf(position) ||
      this.isNorthEastOf(position) ||
      this.isNorthWestOf(position) ||
      this.isSouthEastOf(position) ||
      this.isSouthWestOf(position)
    );
  }

  // isNeighborToType(type: TileType, tiles: Tile[]) {
  //   return tiles.some((tile) => tile.isNeighborTo(this) && tile.type === type);
  // }

  // isNeighborToGrass(tiles: Tile[]) {
  //   return tiles.some(
  //     (tile: Tile) => tile.isNeighborTo(this) && tile.type === TileType.GRASS,
  //   );
  // }

  // isNeighborToTree(tiles: Tile[]) {
  //   return tiles.some(
  //     (tile) => tile.isNeighborTo(this) && tile.type === TileType.TREE,
  //   );
  // }

  // isNeighborToWater(tiles: Tile[]) {
  //   return tiles.some(
  //     (tile) => tile.isNeighborTo(this) && tile.type === TileType.WATER,
  //   );
  // }

  // isNeighborToSand(tiles: Tile[]) {
  //   return tiles.some(
  //     (tile) => tile.isNeighborTo(this) && tile.type === TileType.SAND,
  //   );
  // }

  getNeighbors(tiles: Tile[]) {
    return tiles.filter((tile) => tile.isNeighborTo(this));
  }

  // getNeighborTypes(tiles: Tile[]) {
  //   return this.getNeighbors(tiles).map((tile) => tile.type);
  // }

  // hasNoNeighborOfType(type: TileType, tiles: Tile[]) {
  //   return this.getNeighborTypes(tiles).every((t) => t !== type);
  // }

  hasExploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => t.explored);
  }

  hasUnexploredNeighbor(tiles: Tile[]) {
    return this.getNeighbors(tiles).some((t) => !t.explored);
  }

  has({ row, col }: { row: number; col: number }) {
    return this.row === row && this.col === col;
  }
}
