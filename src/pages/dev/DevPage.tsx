import { useEffect, useRef } from "react";
import { Canvas } from "../../canvas";
import { DevGame } from "../../core/DevGame";
import { BuildingType } from "../../core/Building";
import type { Coordinate } from "../../types/coordinate";
import "../game/game.css";

const BOARD_SIZE = 15;

export const DevPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null) {
      return;
    }

    const canvas = new Canvas(canvasRef.current, wrapperRef.current);
    const game = new DevGame(canvas, BOARD_SIZE);

    const loop = () => {
      canvas.init();
      game.render();
      canvas.reset();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    canvas.click((position: Coordinate) => game.click(position));

    canvas.keydown({
      // Buildings
      h: (position) => game.build(BuildingType.house, position),
      t: (position) => game.build(BuildingType.tower, position),
      w: (position) => game.build(BuildingType.wall, position),
      r: (position) => game.build(BuildingType.church, position),

      // Units
      p: (position) => game.spawnPeasant(position),
      x: (position) => game.attack(position),

      // Equipment
      "1": (position) => game.craftSword(position),
      "2": (position) => game.craftShield(position),
      "3": (position) => game.craftBow(position),
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Game view — sidebar uses CSS classes + id-based DOM manipulation from DevGame
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
            <h2>Dev Mode</h2>
            <p style={{ fontSize: "0.8rem", color: "#aaa", margin: "0.5rem 0" }}>
              Both players controlled locally. No server needed.
            </p>
          </section>

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
            <h2>Controls</h2>
            <div style={{ fontSize: "0.75rem", lineHeight: 1.6 }}>
              <div><strong>Click</strong> — Select / Move / Attack</div>
              <div><strong>H</strong> — Build House (1 wood)</div>
              <div><strong>T</strong> — Build Tower (10 stone)</div>
              <div><strong>W</strong> — Build Wall (1 stone)</div>
              <div><strong>R</strong> — Build Church (3w + 3s)</div>
              <div><strong>P</strong> — Spawn Peasant (1 food)</div>
              <div><strong>1</strong> — Craft Sword (1 iron)</div>
              <div><strong>2</strong> — Craft Shield (1 wood)</div>
              <div><strong>3</strong> — Craft Bow (1w + 1i)</div>
              <div><strong>X</strong> — Attack (select first)</div>
              <div><strong>Arrows</strong> — Pan camera</div>
            </div>
          </section>

          <section className="panel">
            <h2>Log</h2>
            <div
              id="dev-log"
              style={{
                fontSize: "0.7rem",
                maxHeight: "200px",
                overflow: "auto",
                color: "#ccc",
              }}
            />
          </section>
        </aside>
      </div>
    </div>
  );
};
