import { useRef, useEffect, useState, useCallback } from "react";
import { GameMap, defaultMapConfig, type MapConfig } from "@shared/map/map.ts";
import { createRandom } from "@shared/utils/random.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";
import "./map.css";

// ============================================
// HEX GEOMETRY
// ============================================

const HEX_RADIUS = 20;
const HEX_WIDTH = HEX_RADIUS * Math.sqrt(3);
const HEX_HEIGHT = HEX_RADIUS * 2;

const hexX = (row: number, column: number): number =>
  column * HEX_WIDTH + (row % 2 === 1 ? HEX_WIDTH / 2 : 0) + HEX_WIDTH / 2 + 20;

const hexY = (row: number): number =>
  row * HEX_HEIGHT * 0.75 + HEX_HEIGHT / 2 + 20;

// ============================================
// COLOR THEMES
// ============================================

type ColorTheme = {
  readonly name: string;
  readonly background: string;
  readonly border: string;
  readonly colors: Record<string, string>;
};

const COLOR_THEMES: ReadonlyArray<ColorTheme> = [
  {
    name: "Classic",
    background: "#111111",
    border: "#00000033",
    colors: {
      [LandscapeType.grass]: "#5a8a3c",
      [LandscapeType.tree]: "#2d5a1e",
      [LandscapeType.mountain]: "#8a7a6a",
      [LandscapeType.water]: "#2a5a8a",
      [LandscapeType.sand]: "#c4a95a",
      [LandscapeType.farm]: "#8aaa4a",
      [LandscapeType.unexplored]: "#333333",
    },
  },
  {
    name: "Parchment",
    background: "#2a2318",
    border: "#1a150e55",
    colors: {
      [LandscapeType.grass]: "#8a9a5a",
      [LandscapeType.tree]: "#5a6a3a",
      [LandscapeType.mountain]: "#6a5a4a",
      [LandscapeType.water]: "#4a6a7a",
      [LandscapeType.sand]: "#b8a878",
      [LandscapeType.farm]: "#9aaa6a",
      [LandscapeType.unexplored]: "#3a3028",
    },
  },
  {
    name: "Satellite",
    background: "#0a0a12",
    border: "#00000022",
    colors: {
      [LandscapeType.grass]: "#4a7a2e",
      [LandscapeType.tree]: "#1a4a0e",
      [LandscapeType.mountain]: "#7a6a58",
      [LandscapeType.water]: "#1a3a6a",
      [LandscapeType.sand]: "#c4b070",
      [LandscapeType.farm]: "#6a9a3a",
      [LandscapeType.unexplored]: "#222222",
    },
  },
  {
    name: "Winter",
    background: "#1a1a2a",
    border: "#ffffff11",
    colors: {
      [LandscapeType.grass]: "#a8b8a0",
      [LandscapeType.tree]: "#607860",
      [LandscapeType.mountain]: "#c8c8d0",
      [LandscapeType.water]: "#3a5a7a",
      [LandscapeType.sand]: "#b0a890",
      [LandscapeType.farm]: "#90a880",
      [LandscapeType.unexplored]: "#2a2a3a",
    },
  },
  {
    name: "Desert",
    background: "#1a1408",
    border: "#00000033",
    colors: {
      [LandscapeType.grass]: "#8a9050",
      [LandscapeType.tree]: "#5a6830",
      [LandscapeType.mountain]: "#9a7a5a",
      [LandscapeType.water]: "#2a6878",
      [LandscapeType.sand]: "#d4b870",
      [LandscapeType.farm]: "#a0a058",
      [LandscapeType.unexplored]: "#2a2010",
    },
  },
  {
    name: "Night",
    background: "#06060e",
    border: "#ffffff08",
    colors: {
      [LandscapeType.grass]: "#1a2a1a",
      [LandscapeType.tree]: "#0e1a0e",
      [LandscapeType.mountain]: "#2a2a30",
      [LandscapeType.water]: "#0a1a2a",
      [LandscapeType.sand]: "#3a3428",
      [LandscapeType.farm]: "#1a2a18",
      [LandscapeType.unexplored]: "#0a0a10",
    },
  },
];

// ============================================
// RENDERING
// ============================================

const drawHex = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  fillColor: string,
  borderColor: string,
): void => {
  ctx.beginPath();
  Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 6;
    const pointX = centerX + HEX_RADIUS * Math.cos(angle);
    const pointY = centerY + HEX_RADIUS * Math.sin(angle);
    if (index === 0) {
      ctx.moveTo(pointX, pointY);
    } else {
      ctx.lineTo(pointX, pointY);
    }
  });
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  ctx.stroke();
};

const renderMap = (
  ctx: CanvasRenderingContext2D,
  tiles: ReadonlyArray<Tile>,
  size: number,
  theme: ColorTheme,
): void => {
  const dpr = window.devicePixelRatio ?? 1;
  const canvasWidth = size * HEX_WIDTH + HEX_WIDTH / 2 + 40;
  const canvasHeight = size * HEX_HEIGHT * 0.75 + HEX_HEIGHT * 0.25 + 40;

  ctx.canvas.width = canvasWidth * dpr;
  ctx.canvas.height = canvasHeight * dpr;
  ctx.canvas.style.width = `${canvasWidth}px`;
  ctx.canvas.style.height = `${canvasHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  tiles.forEach((tile) => {
    const centerX = hexX(tile.row, tile.column);
    const centerY = hexY(tile.row);
    const color = theme.colors[tile.landscape?.type ?? "unexplored"] ?? "#333333";
    drawHex(ctx, centerX, centerY, color, theme.border);
  });
};

// ============================================
// STATS
// ============================================

const countTerrain = (tiles: ReadonlyArray<Tile>): Record<string, number> =>
  tiles.reduce<Record<string, number>>((acc, tile) => {
    const terrainType = tile.landscape?.type ?? "unknown";
    return { ...acc, [terrainType]: (acc[terrainType] ?? 0) + 1 };
  }, {});

// ============================================
// COMPONENT
// ============================================

export const MapPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState("default");
  const [size, setSize] = useState(20);
  const [themeIndex, setThemeIndex] = useState(0);
  const [forestDensity, setForestDensity] = useState(defaultMapConfig.forestDensity);
  const [mountainDensity, setMountainDensity] = useState(defaultMapConfig.mountainDensity);
  const [waterLevel, setWaterLevel] = useState(defaultMapConfig.waterLevel);
  const [stats, setStats] = useState<Record<string, number>>({});
  const tilesRef = useRef<ReadonlyArray<Tile>>([]);

  const theme = COLOR_THEMES[themeIndex] ?? COLOR_THEMES[0];

  const generateTiles = useCallback(() => {
    const random = createRandom(seed);
    const config: MapConfig = { forestDensity, mountainDensity, waterLevel };
    tilesRef.current = GameMap.generate(size, random, config) as Tile[];
    setStats(countTerrain(tilesRef.current));
  }, [seed, size, forestDensity, mountainDensity, waterLevel]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    if (tilesRef.current.length === 0) return;
    renderMap(ctx, tilesRef.current, size, theme);
  }, [size, theme]);

  useEffect(() => {
    generateTiles();
  }, [generateTiles]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, stats]);

  const randomizeSeed = () => {
    setSeed(Math.random().toString(36).slice(2, 10));
  };

  return (
    <div className="map-page">
      <div className="map-canvas-area">
        <canvas ref={canvasRef} />
      </div>

      <div className="map-controls">
        <h2>Map Generator</h2>

        <label className="map-control-label">
          Seed
          <div className="map-control-row">
            <input
              type="text"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              className="map-input"
            />
            <button onClick={randomizeSeed} className="map-btn">
              Random
            </button>
          </div>
        </label>

        <label className="map-control-label">
          Size: {size}x{size}
          <input
            type="range"
            min={5}
            max={40}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
            className="map-slider"
          />
        </label>

        <label className="map-control-label">
          Water: {Math.round(waterLevel * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(waterLevel * 100)}
            onChange={(event) => setWaterLevel(Number(event.target.value) / 100)}
            className="map-slider"
          />
        </label>

        <label className="map-control-label">
          Forest: {Math.round(forestDensity * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(forestDensity * 100)}
            onChange={(event) => setForestDensity(Number(event.target.value) / 100)}
            className="map-slider"
          />
        </label>

        <label className="map-control-label">
          Mountain: {Math.round(mountainDensity * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(mountainDensity * 100)}
            onChange={(event) => setMountainDensity(Number(event.target.value) / 100)}
            className="map-slider"
          />
        </label>

        <label className="map-control-label">
          Theme
          <select
            value={themeIndex}
            onChange={(event) => setThemeIndex(Number(event.target.value))}
            className="map-select"
          >
            {COLOR_THEMES.map((colorTheme, index) => (
              <option key={colorTheme.name} value={index}>
                {colorTheme.name}
              </option>
            ))}
          </select>
        </label>

        <div className="map-stats">
          <h3>Terrain</h3>
          {Object.entries(stats)
            .toSorted(([, countA], [, countB]) => countB - countA)
            .map(([terrainType, count]) => (
              <div key={terrainType} className="map-stat-row">
                <span
                  className="map-stat-swatch"
                  style={{ backgroundColor: theme.colors[terrainType] ?? "#333" }}
                />
                <span className="map-stat-label">{terrainType}</span>
                <span className="map-stat-count">{count}</span>
                <span className="map-stat-pct">
                  {Math.round((count / (size * size)) * 100)}%
                </span>
              </div>
            ))}
          <div className="map-stat-row map-stat-total">
            <span className="map-stat-label">Total</span>
            <span className="map-stat-count">{size * size}</span>
          </div>
        </div>

        <div className="map-legend">
          <h3>Legend</h3>
          {Object.entries(theme.colors)
            .filter(([key]) => key !== LandscapeType.unexplored && key !== LandscapeType.farm)
            .map(([terrainType, color]) => (
              <div key={terrainType} className="map-legend-item">
                <span className="map-stat-swatch" style={{ backgroundColor: color }} />
                <span>{terrainType}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
