import { Canvas } from "./canvas";
import { Game } from "./core/Board";
import { BuildingType } from "./core/Building";

import "./style.css";
import type { Coordinate } from "./types/coordinate";

const canvas = new Canvas();
const game = new Game(canvas);

// Get game ID from path parameter
const gameId = window.location.pathname.split("/").pop();

if (!gameId) {
  console.error("No game ID found in URL");
} else {
  // Fetch initial game state from server
  fetch(`/api/game/${gameId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load game: ${response.statusText}`);
      }
      return response.json();
    })
    .then((gameData) => {
      game.parse(gameData);
      console.log("Game loaded:", game.id);
      startRenderLoop();
    })
    .catch((error) => {
      console.error("Error loading game:", error);
    });
}

/**
 * Render loop - only renders, no game logic
 * All game logic is handled on the server
 */
function startRenderLoop(): void {
  const loop = () => {
    if (!canvas.ctx) {
      return;
    }

    canvas.init();
    game.render();
    canvas.reset();

    requestAnimationFrame(loop);
  };

  loop();
}

// ============================================
// INPUT HANDLERS
// All inputs send actions to the server
// ============================================

// Click handler - for selecting and moving
canvas.click((position: Coordinate) => game.click(position));

// Keyboard shortcuts for actions
canvas.keydown({
  // Build actions
  h: (position) => game.build(BuildingType.house, position),
  t: (position) => game.build(BuildingType.tower, position),
  c: (position) => game.build(BuildingType.castle, position),
  b: (position) => game.build(BuildingType.boat, position),
  f: (position) => game.buildFarm(position),

  // Unit actions
  p: (position) => game.createPeasant(position),
  u: (position) => game.upgrade(position),
  a: (position) => game.upgradeArcher(position),
  x: (position) => game.attack(position),
});

// Log controls to console
console.log(`
🎮 Game Controls:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Click     - Select unit/building, move, or loot
Arrow Keys - Pan camera

Building (hover + press key):
  H - Build House
  T - Build Tower
  C - Build Castle
  B - Build Boat
  F - Build Farm

Units:
  P - Create Peasant (on house)
  U - Upgrade unit
  A - Upgrade to Archer
  X - Attack target
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
