export class EmptyRender {
  render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.restore();
  }
}
