import { useEffect, useRef, useState } from "react";
import { Canvas } from "../../canvas";
import { Hexagon } from "../../core/Hexagon";
import { Landscape, LandscapeType } from "../../core/Landscape";
import { Tile } from "../../core/Tile";
import { Piece, PieceKind } from "../../core/Piece";
import { Building, BuildingType } from "../../core/Building";
import { defaultImageAssets, type ImageAssets } from "../../images";
import { generateMap } from "@shared/map/map";
import { defaultMapConfig, type MapConfig } from "@shared/map/map";
import { createRandom } from "@shared/utils/random";
import { createPlayer } from "@shared/player";
import type { Tile as SharedTile } from "@shared/map/tile";
import type { Coordinate } from "../../types/coordinate";
import "./sandbox.css";

// ============================================
// TILE CREATION FROM MAP DATA
// ============================================

const createTileFromMapData = (mapTile: SharedTile): Tile =>
  new Tile({
    row: mapTile.row,
    column: mapTile.column,
    explored: true,
    landscape:
      mapTile.landscape !== null
        ? new Landscape(mapTile.landscape)
        : undefined,
  });

// ============================================
// TOOL TYPES
// ============================================

type PlacementTool =
  | { readonly type: "select" }
  | { readonly type: "erase" }
  | { readonly type: "piece"; readonly kind: PieceKind; readonly owner: "day" | "night" }
  | { readonly type: "building"; readonly buildingType: BuildingType; readonly owner: "day" | "night" };

const PIECE_TOOLS: ReadonlyArray<{ readonly label: string; readonly kind: PieceKind }> = [
  { label: "Peasant", kind: PieceKind.peasant },
  { label: "King", kind: PieceKind.king },
  { label: "Priest", kind: PieceKind.priest },
  { label: "Arch Angel", kind: PieceKind.archAngel },
];

const BUILDING_TOOLS: ReadonlyArray<{ readonly label: string; readonly buildingType: BuildingType }> = [
  { label: "House", buildingType: BuildingType.house },
  { label: "Tower", buildingType: BuildingType.tower },
  { label: "Castle", buildingType: BuildingType.castle },
  { label: "Wall", buildingType: BuildingType.wall },
  { label: "Church", buildingType: BuildingType.church },
];

// ============================================
// SANDBOX STATE
// ============================================

type SandboxState = {
  tiles: Tile[];
  selectedTile: Tile | null;
};

const createSandboxState = (mapTiles: ReadonlyArray<SharedTile>): SandboxState => ({
  tiles: mapTiles.map(createTileFromMapData),
  selectedTile: null,
});

// ============================================
// PLACEMENT LOGIC
// ============================================

const applyTool = (
  state: SandboxState,
  tile: Tile,
  tool: PlacementTool,
  imageAssets: ImageAssets,
): SandboxState => {
  switch (tool.type) {
    case "select":
      return { ...state, selectedTile: tile };

    case "erase": {
      const updatedTile = new Tile({
        row: tile.row,
        column: tile.column,
        explored: true,
        landscape: tile.landscape !== null ? new Landscape(tile.landscape) : undefined,
      });
      return {
        ...state,
        tiles: state.tiles.map((existingTile) =>
          existingTile.row === tile.row && existingTile.column === tile.column
            ? updatedTile
            : existingTile,
        ),
      };
    }

    case "piece": {
      const owner = createPlayer({ type: tool.owner });
      const piece = new Piece({
        kind: tool.kind,
        owner,
        viewRange: tool.kind === PieceKind.king ? 2 : tool.kind === PieceKind.archAngel ? 3 : 1,
        attackRange: 1,
        walkableLandscape: [LandscapeType.grass, LandscapeType.sand, LandscapeType.farm],
      });
      const updatedTile = new Tile({
        row: tile.row,
        column: tile.column,
        explored: true,
        landscape: tile.landscape !== null ? new Landscape(tile.landscape) : undefined,
        building: tile.building,
        piece,
      });
      return {
        ...state,
        tiles: state.tiles.map((existingTile) =>
          existingTile.row === tile.row && existingTile.column === tile.column
            ? updatedTile
            : existingTile,
        ),
      };
    }

    case "building": {
      const owner = createPlayer({ type: tool.owner });
      const viewRange =
        tool.buildingType === BuildingType.tower ? 4
        : tool.buildingType === BuildingType.castle ? 3
        : 1;
      const building = new Building({
        type: tool.buildingType,
        viewRange,
        owner,
      });
      const updatedTile = new Tile({
        row: tile.row,
        column: tile.column,
        explored: true,
        landscape: tile.landscape !== null ? new Landscape(tile.landscape) : undefined,
        building,
        piece: tile.piece,
      });
      return {
        ...state,
        tiles: state.tiles.map((existingTile) =>
          existingTile.row === tile.row && existingTile.column === tile.column
            ? updatedTile
            : existingTile,
        ),
      };
    }
  }
};

// ============================================
// COMPONENT
// ============================================

export const SandboxPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SandboxState>({ tiles: [], selectedTile: null });
  const canvasInstanceRef = useRef<Canvas | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const imageAssets = defaultImageAssets;

  const [seed, setSeed] = useState("sandbox");
  const [size, setSize] = useState(15);
  const [tool, setTool] = useState<PlacementTool>({ type: "select" });
  const [owner, setOwner] = useState<"day" | "night">("day");
  const [selectedInfo, setSelectedInfo] = useState<string>("");
  const toolRef = useRef<PlacementTool>(tool);

  const generateAndLoad = () => {
    const random = createRandom(seed);
    const mapTiles = generateMap(size, random) as SharedTile[];
    stateRef.current = createSandboxState(mapTiles);
    setSelectedInfo("");
  };

  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null) return;

    const canvas = new Canvas(canvasRef.current, wrapperRef.current);
    canvasInstanceRef.current = canvas;

    generateAndLoad();

    // Render loop
    const loop = () => {
      canvas.init();

      const state = stateRef.current;
      state.tiles.forEach((tile) => {
        tile.render(canvas.ctx, imageAssets);
      });

      // Render selection highlight
      if (state.selectedTile !== null) {
        Hexagon.render(canvas.ctx, state.selectedTile.x, state.selectedTile.y, "#00ffff");
      }

      // Render hover
      const hoveredTile = state.tiles.find((tile) =>
        tile.isMouseOver(canvas.mousePosition.x, canvas.mousePosition.y),
      );
      if (hoveredTile !== undefined) {
        hoveredTile.renderHovered(canvas.ctx);
      }

      canvas.reset();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    // Click handler
    canvas.click((position: Coordinate) => {
      const clickedTile = stateRef.current.tiles.find((tile) =>
        tile.isMouseOver(position.x, position.y),
      );
      if (clickedTile === undefined) return;

      stateRef.current = applyTool(stateRef.current, clickedTile, toolRef.current, imageAssets);

      const tileInfo = [
        `(${clickedTile.row}, ${clickedTile.column})`,
        clickedTile.landscape !== null ? clickedTile.landscape.type : null,
        clickedTile.building !== undefined ? `${clickedTile.building.type} [${clickedTile.building.owner.type}]` : null,
        clickedTile.piece !== undefined ? `${clickedTile.piece.kind} [${clickedTile.piece.owner.type}]` : null,
      ].filter((segment) => segment !== null).join(" | ");
      setSelectedInfo(tileInfo);
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Regenerate map when seed/size changes
  const handleRegenerate = () => {
    generateAndLoad();
  };

  const randomizeSeed = () => {
    setSeed(Math.random().toString(36).slice(2, 10));
  };

  // Keep ref in sync with state so the click handler reads latest tool
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  return (
    <div className="sandbox-page">
      <div className="sandbox-canvas-area" ref={wrapperRef}>
        <canvas ref={canvasRef} width="800" height="600" />
      </div>

      <div className="sandbox-controls">
        <h2>Sandbox</h2>

        <div className="sandbox-section">
          <h3>Map</h3>
          <label className="sandbox-label">
            Seed
            <div className="sandbox-row">
              <input
                type="text"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                className="sandbox-input"
              />
              <button onClick={randomizeSeed} className="sandbox-btn">Rnd</button>
            </div>
          </label>
          <label className="sandbox-label">
            Size: {size}
            <input
              type="range"
              min={5}
              max={30}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
              className="sandbox-slider"
            />
          </label>
          <button onClick={handleRegenerate} className="sandbox-btn sandbox-btn-wide">
            Generate
          </button>
        </div>

        <div className="sandbox-section">
          <h3>Owner</h3>
          <div className="sandbox-row">
            <button
              className={`sandbox-btn ${owner === "day" ? "sandbox-btn-active-day" : ""}`}
              onClick={() => setOwner("day")}
            >
              Day
            </button>
            <button
              className={`sandbox-btn ${owner === "night" ? "sandbox-btn-active-night" : ""}`}
              onClick={() => setOwner("night")}
            >
              Night
            </button>
          </div>
        </div>

        <div className="sandbox-section">
          <h3>Tools</h3>
          <button
            className={`sandbox-btn sandbox-btn-wide ${tool.type === "select" ? "sandbox-btn-active" : ""}`}
            onClick={() => setTool({ type: "select" })}
          >
            Select
          </button>
          <button
            className={`sandbox-btn sandbox-btn-wide ${tool.type === "erase" ? "sandbox-btn-active" : ""}`}
            onClick={() => setTool({ type: "erase" })}
          >
            Erase
          </button>
        </div>

        <div className="sandbox-section">
          <h3>Pieces</h3>
          {PIECE_TOOLS.map((pieceTool) => (
            <button
              key={pieceTool.kind}
              className={`sandbox-btn sandbox-btn-wide ${
                tool.type === "piece" && tool.kind === pieceTool.kind ? "sandbox-btn-active" : ""
              }`}
              onClick={() => setTool({ type: "piece", kind: pieceTool.kind, owner })}
            >
              {pieceTool.label}
            </button>
          ))}
        </div>

        <div className="sandbox-section">
          <h3>Buildings</h3>
          {BUILDING_TOOLS.map((buildingTool) => (
            <button
              key={buildingTool.buildingType}
              className={`sandbox-btn sandbox-btn-wide ${
                tool.type === "building" && tool.buildingType === buildingTool.buildingType ? "sandbox-btn-active" : ""
              }`}
              onClick={() => setTool({ type: "building", buildingType: buildingTool.buildingType, owner })}
            >
              {buildingTool.label}
            </button>
          ))}
        </div>

        {selectedInfo !== "" && (
          <div className="sandbox-section">
            <h3>Selected</h3>
            <div className="sandbox-info">{selectedInfo}</div>
          </div>
        )}
      </div>
    </div>
  );
};
