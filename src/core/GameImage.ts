export class GameImage {
  readonly width: number;
  readonly height: number;

  readonly image: HTMLImageElement;

  constructor({
    src,
    width,
    height,
  }: {
    src: string;
    width: number;
    height: number;
  }) {
    this.width = width;
    this.height = height;

    this.image = new Image();
    this.image.src = src;

    this.image.onerror = () => {
      console.error("Error loading image", src);
    };
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (!this.image.complete) {
      return;
    }

    // Pixel-art sprites smaller than their drawn size (zoom included) must
    // scale with hard pixels; larger sources look better smoothed.
    const zoom = ctx.getTransform().a || 1;
    const upscaling = this.image.naturalWidth < this.width * zoom;
    ctx.imageSmoothingEnabled = !upscaling;
    ctx.drawImage(this.image, x, y, this.width, this.height);
  }

  /** Draw with the image's own size, centered on (cx, cy) */
  renderCentered(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    this.render(ctx, cx - this.width / 2, cy - this.height / 2);
  }

  /** Draw scaled (e.g. 0.5 for a badge), centered on (cx, cy) */
  renderScaled(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
    if (!this.image.complete) {
      return;
    }
    const w = this.width * scale;
    const h = this.height * scale;
    const zoom = ctx.getTransform().a || 1;
    ctx.imageSmoothingEnabled = this.image.naturalWidth >= w * zoom;
    ctx.drawImage(this.image, cx - w / 2, cy - h / 2, w, h);
  }
}
