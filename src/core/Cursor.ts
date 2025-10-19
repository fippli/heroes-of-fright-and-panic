import cursorSrc from "../assets/cursor.png";
import { State } from "../state";
import { Axe } from "./Axe";
import { Hexagon } from "./Hexagon";
import { TileType } from "./TileType";

export class Cursor {
  width: number;
  height: number;
  isLoaded: boolean;
  image: HTMLImageElement;

  constructor() {
    this.width = Hexagon.width;
    this.height = Hexagon.height;
    this.isLoaded = false;
    this.image = new Image();

    this.image.src = cursorSrc;

    this.image.onload = () => {
      this.isLoaded = true;
    };

    this.image.onerror = () => {
      console.error("Error loading image", cursorSrc);
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    mouseX: number,
    mouseY: number,
    state: State,
  ) {
    ctx.save();

    const tile = state.tiles.find((tile) => tile.isMouseOver(mouseX, mouseY));

    if (tile) {
      switch (tile.type) {
        case TileType.TREE: {
          Axe.render(ctx, mouseX, mouseY);
          break;
        }

        default: {
          ctx.drawImage(this.image, mouseX, mouseY, this.width, this.height);
          break;
        }
      }
    } else {
      ctx.drawImage(this.image, mouseX, mouseY, this.width, this.height);
    }

    ctx.restore();
  }
}
