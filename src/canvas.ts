export class Canvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mousePosition: { x: number; y: number };
  translation: { x: number; y: number };

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.mousePosition = { x: Infinity, y: Infinity };
    this.translation = { x: 0, y: 0 };

    const canvasWrapper = document.querySelector(
      ".canvas-wrapper",
    ) as HTMLDivElement;

    this.canvas.width = canvasWrapper.clientWidth;
    this.canvas.height = canvasWrapper.clientHeight;

    this.canvas.addEventListener("mousemove", (event) => {
      const distanceFromTop =
        event.clientY - canvasWrapper.getBoundingClientRect().top;
      this.mousePosition = {
        x: event.clientX - this.translation.x,
        y: distanceFromTop - this.translation.y,
      };
    });

    this.canvas.tabIndex = 0; // make focusable
    this.canvas.focus();

    this.canvas.addEventListener("keydown", (event) => {
      const speed = 25;

      switch (event.key) {
        case "ArrowLeft": {
          return this.translate(this.translation.x + speed, this.translation.y);
        }
        case "ArrowRight": {
          return this.translate(this.translation.x - speed, this.translation.y);
        }
        case "ArrowUp": {
          return this.translate(this.translation.x, this.translation.y + speed);
        }
        case "ArrowDown": {
          return this.translate(this.translation.x, this.translation.y - speed);
        }
        default: {
          return;
        }
      }
    });
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  translate(x: number, y: number) {
    this.translation = { x, y };
  }

  init() {
    this.clear();
    this.ctx.translate(this.translation.x, this.translation.y);
  }

  reset() {
    this.ctx.resetTransform();
  }

  click(fn: ({ x, y }: { x: number; y: number }) => void) {
    const handler = (_event: MouseEvent) => {
      fn(this.mousePosition);
    };

    this.canvas.addEventListener("click", handler);
  }

  keydown(keymap: { [key: string]: () => void }) {
    const handler = (event: KeyboardEvent) => {
      const fn = keymap[event.key.toLowerCase()];
      fn?.();
    };

    this.canvas.addEventListener("keydown", handler);
  }
}
