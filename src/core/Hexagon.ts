export const remainingDistanceToRadius = (r: number) =>
  r * (1 - Math.sqrt(3) / 2);

export const topTriangleHeight = (r: number) => r / 2;

export const width = (r: number) => 2 * (r - remainingDistanceToRadius(r));

export const layerCount = (n: number) => {
  if (n === 0) {
    return 1;
  }
  return n * 6;
};

export class Hexagon {
  static radius: number = 2 * 3 * 5;
  static borderWidth: number = 4;
  static width =
    2 * (this.radius - remainingDistanceToRadius(this.radius)) +
    this.borderWidth;
  static height = 2 * this.radius + this.borderWidth;
  static innerRadius: number = this.width / 2 - this.borderWidth;

  static render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hover: boolean = false
  ) {
    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = hover ? "orange" : "green";
    ctx.lineWidth = this.borderWidth;

    // ctx.moveTo(x, y);

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const xOffset = x + this.radius * Math.cos(angle);
      const yOffset = y + this.radius * Math.sin(angle);
      ctx.lineTo(xOffset, yOffset);
    }

    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    Hexagon.debug(ctx, x, y);
  }

  static debug(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // ctx.strokeStyle = "#00ffff";
    // ctx.arc(x, y, 2, 0, 2 * Math.PI);
    // ctx.stroke();

    ctx.restore();

    ctx.save();

    Hexagon.debugCircle(ctx, x, y);
    // Hexagon.debugRectangle(ctx, x, y);
    Hexagon.debugLine(ctx, x, y);

    ctx.restore();
  }

  static debugCircle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // Draw a circle for debug
    ctx.beginPath();
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 1;
    ctx.arc(x, y, this.radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#ff0088";
    ctx.lineWidth = 1;
    ctx.arc(x, y, this.innerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  static debugRectangle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // Draw a rectangle for debug
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(
      x - Hexagon.width / 2,
      y - Hexagon.height / 2,
      Hexagon.width,
      Hexagon.height
    );
    ctx.stroke();

    ctx.restore();
  }

  static debugLine(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    ctx.strokeStyle = "#8888ff";
    ctx.lineWidth = 1;

    // Draw a line from the center of the hexagon to the bottom
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - Hexagon.height / 2);
    ctx.stroke();

    // Draw a line from the center of the hexagon to the left
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Hexagon.width / 2, y);
    ctx.stroke();

    // Draw a circle on x, y
    ctx.beginPath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 1;
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  static x(row: number, col: number) {
    if (row % 2 === 0) {
      return this.width * col;
    } else {
      return this.width * (col + 1 / 2);
    }
  }

  static y(row: number) {
    return ((row * this.height) / 2) * (3 / 2);
  }

  static collidesWithCoordinates(
    mx: number,
    my: number,
    cx: number,
    cy: number
  ): boolean {
    const dx = Math.abs(mx - cx);
    const dy = Math.abs(my - cy);

    // If ouside of the surrounding circle, return false
    if (Math.sqrt(dx * dx + dy * dy) > this.innerRadius) {
      return false;
    } else {
      console.log(`(${mx}, ${my})`);
      return true;
    }

    // Fast AABB reject

    // if (dx > this.width / 2 || dy > this.radius) {
    //   return false;
    // }

    // // Corner cut test
    // return Math.sqrt(3) * dx + dy <= Math.sqrt(3) * this.radius;
  }
}

// function isPointInHexPointy(mx: number, my: number, cx: number, cy: number, size: number): boolean {
//   const dx = Math.abs(mx - cx);
//   const dy = Math.abs(my - cy);

//   // Fast AABB reject
//   const w = Math.sqrt(3) * 0.5 * size; // half width
//   if (dx > w || dy > size) return false;

//   // Corner cut test
//   return (Math.sqrt(3) * dx + dy) <= (Math.sqrt(3) * size);
// }
