const remainingDistanceToRadius = (r: number) => r * (1 - Math.sqrt(3) / 2);

export class Hexagon {
  static radius: number = 2 * 3 * 5;
  static borderWidth: number = 2;
  static width = 2 * (this.radius - remainingDistanceToRadius(this.radius));
  static height = 2 * this.radius;
  static innerRadius: number = this.width / 2 - this.borderWidth;

  static render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string = "#ffffff11",
  ) {
    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = color;
    ctx.lineWidth = this.borderWidth;

    // ctx.moveTo(x, y);

    Array.from({ length: 6 }, (_, index) => index).forEach((index) => {
      const angle = (Math.PI / 3) * index - Math.PI / 6;
      const xOffset = x + this.radius * Math.cos(angle);
      const yOffset = y + this.radius * Math.sin(angle);
      ctx.lineTo(xOffset, yOffset);
    });

    ctx.closePath();

    ctx.stroke();
    ctx.restore();

    // Hexagon.debug(ctx, x, y);
  }

  static renderArea(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,

    color: string = "#00ffff",
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.clip(Hexagon.path(x, y));

    ctx.fillStyle = color;

    ctx.fillRect(
      x - Hexagon.width / 2,
      y - Hexagon.height / 2,
      Hexagon.width,
      Hexagon.height,
    );
    ctx.restore();
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
      Hexagon.height,
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

  static x(row: number, column: number) {
    if (row % 2 === 0) {
      return this.width * column;
    } else {
      return this.width * (column + 1 / 2);
    }
  }

  static y(row: number) {
    return ((row * this.height) / 2) * (3 / 2);
  }

  static collidesWithCoordinates(
    mx: number,
    my: number,
    cx: number,
    cy: number,
  ): boolean {
    const dx = Math.abs(mx - cx);
    const dy = Math.abs(my - cy);

    // If ouside of the surrounding circle, return false
    if (Math.sqrt(dx * dx + dy * dy) > this.innerRadius) {
      return false;
    } else {
      return true;
    }
  }

  static path(cx: number, cy: number) {
    const path = new Path2D();

    Array.from({ length: 6 }, (_, index) => index).forEach((index) => {
      const angle = (Math.PI / 3) * index - Math.PI / 6;
      const xOffset = cx + this.radius * Math.cos(angle);
      const yOffset = cy + this.radius * Math.sin(angle);
      if (index === 0) {
        path.moveTo(xOffset, yOffset);
      } else {
        path.lineTo(xOffset, yOffset);
      }
    });

    path.closePath();

    return path;
  }
}
