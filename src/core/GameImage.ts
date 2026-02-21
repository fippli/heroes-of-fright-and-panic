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

    ctx.drawImage(this.image, x, y, this.width, this.height);
  }
}
