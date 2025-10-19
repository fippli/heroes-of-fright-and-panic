export class TileImage {
  src: string;
  width: number;
  height: number;
  isLoaded: boolean;
  image: HTMLImageElement;

  constructor(src, width, height) {
    this.src = src;
    this.width = width;
    this.height = height;
    this.isLoaded = false;
    this.image = new Image();

    this.image.src = this.src;

    this.image.onload = () => {
      this.isLoaded = true;
    };

    this.image.onerror = () => {
      console.error("Error loading image", this.src);
    };
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (!this.isLoaded) {
      return;
    }

    ctx.drawImage(
      this.image,
      x - this.width / 2,
      y - this.height / 2,
      this.width,
      this.height,
    );
  }
}
