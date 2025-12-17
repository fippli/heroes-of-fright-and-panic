import './game.css';

import { Canvas } from '../../canvas';
import { Game } from '../../core/Board';
import { BuildingType } from '../../core/Building';
import type { Coordinate } from '../../types/coordinate';

const canvas = new Canvas();

// Get game ID from path parameter
const gameId = window.location.pathname.split('/').pop();

// Get player type from URL query parameter (?player=day or ?player=night)
const urlParams = new URLSearchParams(window.location.search);
const playerParam = urlParams.get('player') as 'day' | 'night' | null;

// Validate player param
const myPlayerType: 'day' | 'night' | null =
  playerParam === 'day' || playerParam === 'night' ? playerParam : null;

// Create game instance with assigned player type
const game = new Game(canvas, myPlayerType);

if (!gameId) {
  console.error('No game ID found in URL');
  showPlayerSelection('No game ID found');
} else if (!myPlayerType) {
  // No player specified - show player selection
  console.log('No player specified. Add ?player=day or ?player=night to the URL');
  showPlayerSelection();
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
      console.log('Game loaded:', game.id, 'Playing as:', myPlayerType);
      startRenderLoop();
    })
    .catch((error) => {
      console.error('Error loading game:', error);
    });
}

/**
 * Show player selection screen
 */
function showPlayerSelection(errorMessage?: string) {
  document.body.innerHTML = `
    <div class="container container--centered">
      <h1 class="hero-title text-gradient">Heroes of Fright and Panic</h1>
      ${errorMessage ? `<p class="message message--error">${errorMessage}</p>` : ''}
      <h2 class="subtitle">Choose your side</h2>
      <div class="cta-buttons">
        <a href="?player=day" class="btn btn--large btn--day">☀️ Day Player</a>
        <a href="?player=night" class="btn btn--large btn--night">🌙 Night Player</a>
      </div>
      <p class="text-muted mt-lg">Share the other link with your opponent!</p>
    </div>
  `;
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
