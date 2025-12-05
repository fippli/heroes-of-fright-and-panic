import { Canvas } from "./canvas";
import { Game } from "./core/Board";
import { BuildingType } from "./core/Building";

import "./style.css";
import type { Coordinate } from "./types/coordinate";

const canvas = new Canvas();

// Get game ID from path parameter
const gameId = window.location.pathname.split("/").pop();

// Get player type from URL query parameter (?player=day or ?player=night)
const urlParams = new URLSearchParams(window.location.search);
const playerParam = urlParams.get("player") as "day" | "night" | null;

// Validate player param
const myPlayerType: "day" | "night" | null =
  playerParam === "day" || playerParam === "night" ? playerParam : null;

// Create game instance with assigned player type
const game = new Game(canvas, myPlayerType);

if (!gameId) {
  console.error("No game ID found in URL");
} else if (!myPlayerType) {
  // No player specified - show player selection
  console.log("No player specified. Add ?player=day or ?player=night to the URL");
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #1a1a2e; color: white;">
      <h1>Heroes of Fright and Panic</h1>
      <h2>Choose your side</h2>
      <div style="display: flex; gap: 20px; margin-top: 20px;">
        <a href="?player=day" style="padding: 20px 40px; background: #ffd700; color: black; text-decoration: none; border-radius: 8px; font-size: 1.2em; font-weight: bold;">
          ☀️ Day Player
        </a>
        <a href="?player=night" style="padding: 20px 40px; background: #4a4a8a; color: white; text-decoration: none; border-radius: 8px; font-size: 1.2em; font-weight: bold;">
          🌙 Night Player
        </a>
      </div>
      <p style="margin-top: 30px; color: #888;">Share the other link with your opponent!</p>
    </div>
  `;
} else {
  // Fetch initial game state from server with player filter
  fetch(`/api/game/${gameId}?player=${myPlayerType}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load game: ${response.statusText}`);
      }
      return response.json();
    })
    .then((gameData) => {
      game.parse(gameData);
      console.log("Game loaded:", game.id, "Playing as:", myPlayerType);
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
