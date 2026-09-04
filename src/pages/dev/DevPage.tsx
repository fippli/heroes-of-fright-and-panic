import { useEffect, useRef, useState } from "react";
import { Canvas } from "../../canvas";
import { DevGame, createGeneratedGame } from "../../core/DevGame";
import { ImageAssets, defaultImageAssets } from "../../images";
import { ThemeImageAssets } from "../../images/theme-image-assets";
import { BuildingType } from "../../core/Building";
import { SteedType } from "@shared/steed";
import { ResearchType } from "@shared/research";
import { scenarios, buildScenarioGame } from "@shared/scenarios";
import type { Coordinate } from "../../types/coordinate";
import "../game/game.css";

const BOARD_SIZE = 15;
const RANDOM_OPTION = "random";

const [firstScenario] = scenarios;

const stateForOption = (option: string) => {
  const scenario = scenarios.find((entry) => entry.id === option);
  if (scenario !== undefined) {
    return {
      game: buildScenarioGame(scenario),
      description: scenario.description,
    };
  }
  return {
    game: createGeneratedGame(BOARD_SIZE),
    description: `Full random ${BOARD_SIZE}x${BOARD_SIZE} map.`,
  };
};

export const DevPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gameRef = useRef<DevGame | null>(null);

  const [selected, setSelected] = useState<string>(
    firstScenario?.id ?? RANDOM_OPTION,
  );
  const [description, setDescription] = useState<string>(
    firstScenario?.description ?? "",
  );

  const handleSelect = (option: string): void => {
    setSelected(option);
    const { game, description: next } = stateForOption(option);
    setDescription(next);
    gameRef.current?.load(game);
  };

  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null) {
      return;
    }

    const canvas = new Canvas(canvasRef.current, wrapperRef.current);
    const initialState =
      firstScenario !== undefined
        ? buildScenarioGame(firstScenario)
        : createGeneratedGame(BOARD_SIZE);

    // `?theme=<id>` previews a theme's sprites without creating a game
    const themeId = new URLSearchParams(window.location.search).get("theme");
    const loadAssets: Promise<ImageAssets> =
      themeId !== null
        ? ThemeImageAssets.fromThemeId(themeId).then((theme) => new ImageAssets(theme))
        : Promise.resolve(defaultImageAssets);

    let cancelled = false;
    loadAssets
      .catch((error) => {
        console.error("Failed to load theme, using defaults:", error);
        return defaultImageAssets;
      })
      .then((imageAssets) => {
        if (cancelled) return;
        const game = new DevGame(canvas, initialState, imageAssets);
        gameRef.current = game;

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

          // Building / unit actions (some need a selected source first)
          n: (position) => game.trainPriest(position), // on church
          m: (position) => game.summonArchAngel(position), // on church
          g: (position) => game.heal(position), // priest selected → ally
          o: (position) => game.buySteed(SteedType.horse, position), // house selected → tile
          f: (position) => game.buySteed(SteedType.boat, position), // house selected → water
          "7": (position) => game.research(ResearchType.queen, position),
        });
      });

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      gameRef.current = null;
    };
  }, []);

  // Game view — sidebar uses CSS classes + id-based DOM manipulation from DevGame
  return (
    <div className="game-body">
      <div id="app">
        <div className="columns">
        <div className="board">
          <div className="canvas-wrapper" ref={wrapperRef}>
            <canvas id="canvas" ref={canvasRef} width="600" height="600" />
          </div>
        </div>

        <aside className="sidebar">
          <section className="panel">
            <h2>Dev Mode</h2>
            <p
              style={{ fontSize: "0.8rem", color: "#aaa", margin: "0.5rem 0" }}
            >
              Both players controlled locally. No server needed.
            </p>
          </section>

          <section className="panel">
            <h2>Scenario</h2>
            <select
              value={selected}
              onChange={(event) => handleSelect(event.target.value)}
              style={{
                width: "100%",
                padding: "0.4rem",
                background: "#1a1a1a",
                color: "#eee",
                border: "1px solid #444",
                borderRadius: "4px",
              }}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
              <option value={RANDOM_OPTION}>
                Random {BOARD_SIZE}×{BOARD_SIZE}
              </option>
            </select>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#aaa",
                margin: "0.5rem 0 0",
              }}
            >
              {description}
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
              <div>
                <strong>Click</strong> — Select / Move / Attack / Harvest
              </div>
              <div>
                <strong>H</strong> — Build House (1 wood)
              </div>
              <div>
                <strong>T</strong> — Build Tower (5 stone + wall)
              </div>
              <div>
                <strong>W</strong> — Build Wall (1 stone)
              </div>
              <div>
                <strong>R</strong> — Build Church (3w + 3s)
              </div>
              <div>
                <strong>P</strong> — Spawn Peasant (1 food)
              </div>
              <div>
                <strong>1</strong> — Craft Sword (1 iron)
              </div>
              <div>
                <strong>2</strong> — Craft Shield (1 wood)
              </div>
              <div>
                <strong>3</strong> — Craft Bow (1w + 1i)
              </div>
              <div>
                <strong>X</strong> — Attack (select first)
              </div>
              <div>
                <strong>E</strong> — Enter Tower → Castle (select king, hover
                tower)
              </div>
              <div>
                <strong>N</strong> — Train Priest (hover church)
              </div>
              <div>
                <strong>M</strong> — Summon Arch Angel (hover church)
              </div>
              <div>
                <strong>G</strong> — Heal (select priest, hover ally)
              </div>
              <div>
                <strong>O / F</strong> — Buy Horse / Boat (select house, hover
                tile)
              </div>
              <div>
                <strong>7</strong> — Research the Queen (castle level 2+)
                / queen (hover castle)
              </div>
              <div>
                <strong>Arrows</strong> — Pan camera
              </div>
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
    </div>
  );
};
