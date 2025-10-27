import { Canvas } from "./canvas";
import { Board } from "./core/Board";
import { BuildingType } from "./core/Building";

import "./style.css";
import type { Coordinate } from "./types/coordinate";

const canvas = new Canvas();
const board = new Board(canvas);

const loop = () => {
  board.calculateNextState(canvas);

  if (!canvas.ctx) {
    return;
  }

  canvas.init();
  board.render();
  canvas.reset();

  requestAnimationFrame(loop);
};

canvas.click((position: Coordinate) => board.click(position));

canvas.keydown({
  a: (position) => board.upgradeArcher(position),
  h: (position) => board.build(BuildingType.house, position),
  t: (position) => board.build(BuildingType.tower, position),
  c: (position) => board.build(BuildingType.castle, position),
  b: (position) => board.build(BuildingType.boat, position),
  f: (position) => board.buildFarm(position),
  p: (position) => board.createPeasant(position),
  u: (position) => board.upgrade(position),
  x: (position) => board.attack(position),
});

loop();
