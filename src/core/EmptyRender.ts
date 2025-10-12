export class EmptyRender {
  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.restore();
  }
}
