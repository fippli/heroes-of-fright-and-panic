import playerSrc from "../assets/player.png";

import { Hexagon } from "./Hexagon";
import { ResourceMap } from "./ResourceMap";
import { TileImage } from "./TileImage";

const playerImage = new TileImage(playerSrc, Hexagon.height, Hexagon.height);

export class Player {
  row: number;
  col: number;
  inventory: string[] = ["axe"];
  resources: ResourceMap = new ResourceMap({});

  constructor({ row, col }: { row: number; col: number }) {
    this.row = row;
    this.col = col;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const x = Hexagon.x(this.row, this.col);
    const y = Hexagon.y(this.row);
    playerImage.render(ctx, x, y);

    ctx.restore();
  }

  collect(loot: ResourceMap) {
    this.resources.add(loot);
  }

  canAfford(cost: ResourceMap) {
    return Object.keys(cost).every(
      (key) =>
        this.resources[key as keyof ResourceMap] >=
        cost[key as keyof ResourceMap],
    );
  }

  pay(cost: ResourceMap) {
    this.resources.subtract(cost);
  }
}
