import { Canvas } from "./canvas";
import { Board } from "./core/Board";
import { BuildingType } from "./core/Building";
import "./style.css";
import type { Coordinate } from "./types/coordinate";

const canvas = new Canvas();
const board = new Board(21);

const loop = () => {
  board.calculateNextState();

  if (!canvas.ctx) return;

  canvas.init();

  board.render(canvas);

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
  f: (position) => board.build(BuildingType.farm, position),
  p: (position) => board.placePeasant(position),
  u: (position) => board.upgrade(position),
});

loop();
