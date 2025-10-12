export class Landscape {

  readonly row: number;
  readonly col: number;

  constructor({ row, col }: { row: number; col: number }) {
    this.row = row;
    this.col = col;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.restore();
  }
}