import { Tile } from "./Tile";

export class Piece {

  row: number;
  col: number;

  constructor({ row, col }: { row: number; col: number }) {
    this.row = row;
    this.col = col;
  }

  render (ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.restore();
  }

  place (tile: Tile) {
    this.row = tile.row;
    this.col = tile.col;
  }

  moveNorth () {
    this.row = this.row - 1;
  }
  moveSouth () {
    this.row = this.row + 1;
  }
  moveEast () {
    this.col = this.col + 1;
  }
  moveWest () {
    this.col = this.col - 1;
  }

  moveNorthEast () {
    this.moveNorth();
    this.moveEast();
  }
  moveNorthWest () {
    this.moveNorth();
    this.moveWest();
  }
  moveSouthEast () {
    this.moveSouth();
    this.moveEast();
  }
  moveSouthWest () {
    this.moveSouth();
    this.moveWest();
  }


};