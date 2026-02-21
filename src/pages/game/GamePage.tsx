import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Canvas } from "../../canvas";
import { Game } from "../../core/Board";
import { BuildingType } from "../../core/Building";
import { supabase, getEdgeFunctionError } from "../../lib/supabase";
import type { Coordinate } from "../../types/coordinate";
import "./game.css";

export const GamePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const canvasInstanceRef = useRef<Canvas | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { id: gameId } = useParams();
  const [searchParams] = useSearchParams();
  const playerParam = searchParams.get("player") as "day" | "night" | null;
  const [error, setError] = useState<string | null>(null);

  // Validate player param
  const myPlayerType: "day" | "night" | null =
    playerParam === "day" || playerParam === "night" ? playerParam : null;

  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null || gameId === undefined || myPlayerType === null) {
      return;
    }

    const canvasElement = canvasRef.current;
    const wrapperElement = wrapperRef.current;

    // Create canvas and game instances
    const canvas = new Canvas(canvasElement, wrapperElement);
    canvasInstanceRef.current = canvas;

    const game = new Game(canvas, myPlayerType);
    gameRef.current = game;

    // Render loop
    const startRenderLoop = () => {
      const loop = () => {
        if (canvas.ctx === null) {
          return;
        }

        canvas.init();
        game.render();
        canvas.reset();

        animationFrameRef.current = requestAnimationFrame(loop);
      };

      loop();
    };

    // Fetch initial game state
    supabase.functions
      .invoke("game-state", { body: { gameId } })
      .then(({ data, error: invokeError }) => {
        if (invokeError !== null) {
          throw new Error(getEdgeFunctionError(invokeError));
        }
        game.parse(data);
        console.log("Game loaded:", game.id, "Playing as:", myPlayerType);
        startRenderLoop();
      })
      .catch((err) => {
        console.error("Error loading game:", err);
        setError(err instanceof Error ? err.message : "Failed to load game");
      });

    // Input handlers
    canvas.click((position: Coordinate) => game.click(position));

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

    // Log controls
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

    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameId, myPlayerType]);

  // Show error state
  if (error !== null) {
    return (
      <div className="game-body">
        <div className="container container--centered">
          <h1 className="hero-title text-gradient">Heroes of Fright and Panic</h1>
          <p className="message message--error">{error}</p>
          <Link to="/games" className="btn btn--large btn--day">
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  // Show player selection if no player specified
  if (gameId === undefined) {
    return (
      <div className="game-body">
        <div className="container container--centered">
          <h1 className="hero-title text-gradient">Heroes of Fright and Panic</h1>
          <p className="message message--error">No game ID found</p>
          <Link to="/games" className="btn btn--large btn--day">
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  if (myPlayerType === null) {
    return (
      <div className="game-body">
        <div className="container container--centered">
          <h1 className="hero-title text-gradient">Heroes of Fright and Panic</h1>
          <h2 className="subtitle">Choose your side</h2>
          <div className="cta-buttons">
            <Link to={`?player=day`} className="btn btn--large btn--day">
              Day Player
            </Link>
            <Link to={`?player=night`} className="btn btn--large btn--night">
              Night Player
            </Link>
          </div>
          <p className="text-muted mt-lg">Share the other link with your opponent!</p>
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div className="game-body">
      <div id="app">
        <div className="board">
          <div className="canvas-wrapper" ref={wrapperRef}>
            <canvas id="canvas" ref={canvasRef} width="600" height="600" />
          </div>
        </div>

        <aside className="sidebar">
          <section className="panel">
            <h2>Time</h2>
            <div id="time" className="time-display" />
            <div id="turn" className="turn-indicator" />
          </section>
          <section className="panel">
            <h2>Resources</h2>
            <div id="resources" className="stat-grid">
              <div>
                <img src="/img/wood.png" alt="wood" />
                <div id="wood" />
              </div>
              <div>
                <img src="/img/stone.png" alt="stone" />
                <div id="stone" />
              </div>
              <div>
                <img src="/img/food.png" alt="food" />
                <div id="food" />
              </div>
              <div>
                <img src="/img/gold.png" alt="gold" />
                <div id="gold" />
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Buildings</h2>
            <div id="buildings" className="stat-grid">
              <div>
                <img src="/img/house.png" alt="buildings" />
                <div id="houses" />
              </div>
              <div>
                <img src="/img/tower.png" alt="buildings" />
                <div id="towers" />
              </div>
              <div>
                <img src="/img/castle.png" alt="buildings" />
                <div id="castles" />
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className="dialog-wrapper">
        <div className="dialog-content">
          <h1 id="dialog-title">Dialog</h1>
          <p id="dialog-text">This is a dialog</p>
          <button id="close-dialog">Close</button>
        </div>
      </div>
    </div>
  );
}
