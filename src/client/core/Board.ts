import type { Canvas } from "../canvas";
import type { Coordinate } from "../types/coordinate";
import { Building, BuildingType } from "./Building";
import { Clock } from "./Clock";
import { Dialog } from "./Dialog";
import { Hexagon } from "./Hexagon";
import { Landscape, LandscapeType } from "./Landscape";
import { Piece, PieceType } from "./Piece";
import { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";
import { Tile } from "./Tile";

const dialog = new Dialog();

// Types for API communication
type PlayerType = "day" | "night";

interface GameAction {
  type: string;
  player: PlayerType;
  position?: { row: number; column: number };
  selectedPosition?: { row: number; column: number };
  buildingType?: BuildingType;
  targetType?: PieceType;
}

interface GameClock {
  time: number;
  hasDawned: boolean;
  hasDusked: boolean;
}

interface ServerGameState {
  id: string;
  _id?: string;
  size: number;
  currentPlayer: PlayerType;
  clock: GameClock;
  dayPlayer: {
    type: "day";
    resources: { wood: number; gold: number; stone: number; food: number };
  };
  nightPlayer: {
    type: "night";
    resources: { wood: number; gold: number; stone: number; food: number };
  };
  tiles: {
    row: number;
    column: number;
    landscape: { type: LandscapeType; lootDrop?: ResourceMap } | null;
    building: Building | null;
    piece: Piece | null;
  }[];
}

interface ActionResponse {
  result: {
    success: boolean;
    error?: string;
    message?: string;
  };
  game: ServerGameState;
}

/**
 * Game class - Client-side render-only implementation
 * All game logic is handled on the server.
 * This class only:
 * - Renders the game state
 * - Sends user inputs to the server
 * - Parses server responses
 */
export class Game {
  id: string = "";
  canvas: Canvas;
  tiles: Tile[] = [];
  clock: Clock = new Clock();

  // Current player (whose turn it is)
  currentPlayer: PlayerType = "day";

  // Player states
  dayPlayer: Player;
  nightPlayer: Player;

  // UI state (client-only, not persisted)
  selectedTile: Tile | undefined | null = undefined;

  // Loading state for API calls
  private isProcessingAction: boolean = false;

  // Track previous time for transition detection
  private previousWasDay: boolean = true;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.dayPlayer = new Player({ type: "day" });
    this.nightPlayer = new Player({ type: "night" });
  }

  /**
   * Get the active player based on current turn
   */
  get player(): Player {
    return this.currentPlayer === "day" ? this.dayPlayer : this.nightPlayer;
  }

  /**
   * Parse game state from server response
   */
  parse(game: ServerGameState): void {
    this.id = game.id || game._id || "";

    // Parse clock
    this.clock = new Clock(game.clock?.time ?? 6);
    const wasDay = this.previousWasDay;
    const isNowDay = this.clock.isDay();

    // Detect time transitions for dialogs
    if (wasDay && !isNowDay) {
      dialog.open({ title: "Dusk", content: "The sun is setting" });
    } else if (!wasDay && isNowDay) {
      dialog.open({ title: "Dawn", content: "The sun is rising" });
    }
    this.previousWasDay = isNowDay;

    // Parse current player
    this.currentPlayer = game.currentPlayer || "day";

    // Parse players
    this.dayPlayer = new Player({
      type: "day",
      resources: new ResourceMap(game.dayPlayer?.resources || {}),
    });
    this.nightPlayer = new Player({
      type: "night",
      resources: new ResourceMap(game.nightPlayer?.resources || {}),
    });

    // Parse tiles
    this.tiles = game.tiles.map(
      (tile) =>
        new Tile({
          row: tile.row,
          column: tile.column,
          landscape: tile.landscape
            ? new Landscape(tile.landscape)
            : undefined,
          building: tile.building
            ? new Building({
                type: tile.building.type,
                production: new ResourceMap(tile.building.production || {}),
                cost: new ResourceMap(tile.building.cost || {}),
                walkable: tile.building.walkable ?? true,
                viewRange: tile.building.viewRange ?? 1,
                owner: new Player({
                  type: tile.building.owner?.type || "day",
                }),
              })
            : undefined,
          piece: tile.piece
            ? new Piece({
                type: tile.piece.type,
                viewRange: tile.piece.viewRange ?? 1,
                owner: new Player({ type: tile.piece.owner?.type || "day" }),
                upgradeCost: new ResourceMap(tile.piece.upgradeCost || {}),
                walkableLandscape: tile.piece.walkableLandscape || [],
                lootableLandscape: tile.piece.lootableLandscape || [],
              })
            : undefined,
        }),
    );

    console.log("Game state parsed", {
      id: this.id,
      currentPlayer: this.currentPlayer,
      clock: this.clock.toString(),
    });
  }

  /**
   * Render the game state - this is called every frame
   */
  render(): void {
    const canvas = this.canvas;
    canvas.ctx.save();

    // Calculate exploration based on current player's view
    this.calculateExploration();

    // Render all tiles
    this.tiles.forEach((tile: Tile) => {
      tile.render(canvas.ctx);
    });

    // Render selected tile highlight
    if (this.selectedTile) {
      this.selectedTile.renderArea(canvas.ctx, this.tiles);
      Hexagon.render(
        canvas.ctx,
        this.selectedTile.x,
        this.selectedTile.y,
        "#00ffff",
      );
    }

    // Render hovered tile
    const hoveredTile = this.findTile(canvas.mousePosition);
    if (hoveredTile) {
      hoveredTile.renderHovered(canvas.ctx);
    }

    canvas.ctx.restore();

    // Render UI
    this.player.resources.render();
    this.clock.render();
  }

  /**
   * Calculate which tiles are explored based on current player's units and buildings
   */
  private calculateExploration(): void {
    // First, unexplore all tiles
    this.tiles.forEach((tile) => (tile.explored = false));

    // Then explore tiles visible to the current player
    this.tiles.forEach((tile) => {
      // Check if tile has a piece owned by current player
      if (tile.piece?.owner?.type === this.currentPlayer) {
        tile.explored = true;
        const viewRange = Math.max(
          tile.building?.viewRange ?? 0,
          tile.piece?.viewRange ?? 0,
        );
        const tilesInRange = tile.getTilesInRange(this.tiles, viewRange);
        tilesInRange.forEach((t) => (t.explored = true));
      }

      // Check if tile has a building owned by current player
      if (tile.building?.owner?.type === this.currentPlayer) {
        tile.explored = true;
      }
    });
  }

  /**
   * Find a tile by pixel position or row/column
   */
  findTile(
    pos: { x: number; y: number } | { row: number; column: number },
  ): Tile | undefined {
    if ("x" in pos && "y" in pos) {
      return this.tiles.find((tile) => tile.isMouseOver(pos.x, pos.y));
    } else {
      return this.tiles.find(
        (tile) => tile.row === pos.row && tile.column === pos.column,
      );
    }
  }

  /**
   * Convert pixel coordinates to tile position
   */
  private pixelToTilePosition(
    pos: Coordinate,
  ): { row: number; column: number } | null {
    const tile = this.findTile(pos);
    if (!tile) return null;
    return { row: tile.row, column: tile.column };
  }

  /**
   * Get the selected tile position (if any)
   */
  private getSelectedPosition(): { row: number; column: number } | undefined {
    if (!this.selectedTile) return undefined;
    return { row: this.selectedTile.row, column: this.selectedTile.column };
  }

  // ============================================
  // API COMMUNICATION
  // ============================================

  /**
   * Send an action to the server and update local state with response
   */
  private async sendAction(action: GameAction): Promise<boolean> {
    if (this.isProcessingAction) {
      console.log("Action already in progress, ignoring");
      return false;
    }

    this.isProcessingAction = true;

    try {
      const response = await fetch(`/api/game/${this.id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(action),
      });

      const data: ActionResponse = await response.json();

      if (data.result.success) {
        // Update local state with server response
        this.parse(data.game);

        if (data.result.message) {
          console.log("Action result:", data.result.message);
        }
      } else {
        console.warn("Action failed:", data.result.error);
        // Still update state in case server made partial changes
        if (data.game) {
          this.parse(data.game);
        }
      }

      return data.result.success;
    } catch (error) {
      console.error("Error sending action:", error);
      return false;
    } finally {
      this.isProcessingAction = false;
    }
  }

  // ============================================
  // USER INPUT HANDLERS
  // ============================================

  /**
   * Handle click on the canvas
   */
  async click({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    const clickedTile = this.findTile(tilePosition);
    if (!clickedTile) return;

    // If clicking on a tile with our piece, just select it locally
    if (clickedTile.piece?.owner?.type === this.currentPlayer) {
      this.selectedTile = clickedTile;
      return;
    }

    // If clicking on a tile with our building (and no piece), select it
    if (
      clickedTile.building?.owner?.type === this.currentPlayer &&
      !clickedTile.piece
    ) {
      this.selectedTile = clickedTile;
      return;
    }

    // If we have a selected tile, try to perform an action
    if (this.selectedTile) {
      const success = await this.sendAction({
        type: "click",
        player: this.currentPlayer,
        position: tilePosition,
        selectedPosition: this.getSelectedPosition(),
      });

      // If the action moved a piece, update selection to the new position
      if (success) {
        const newTile = this.findTile(tilePosition);
        if (newTile?.piece?.owner?.type === this.currentPlayer) {
          this.selectedTile = newTile;
        } else {
          // Clear selection after looting or other actions
          this.selectedTile = undefined;
        }
      }
    } else {
      // No selection, just clicking on empty tile
      this.selectedTile = clickedTile;
    }
  }

  /**
   * Build a structure at the given position
   */
  async build(buildingType: BuildingType, { x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    await this.sendAction({
      type: "build",
      player: this.currentPlayer,
      buildingType,
      position: tilePosition,
      selectedPosition: this.getSelectedPosition(),
    });
  }

  /**
   * Build a farm at the given position
   */
  async buildFarm({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    await this.sendAction({
      type: "build",
      player: this.currentPlayer,
      buildingType: BuildingType.farm,
      position: tilePosition,
      selectedPosition: this.getSelectedPosition(),
    });
  }

  /**
   * Create a peasant at the given position
   */
  async createPeasant({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    await this.sendAction({
      type: "createPeasant",
      player: this.currentPlayer,
      position: tilePosition,
    });
  }

  /**
   * Upgrade a unit at the given position
   */
  async upgrade({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    await this.sendAction({
      type: "upgrade",
      player: this.currentPlayer,
      position: tilePosition,
    });
  }

  /**
   * Upgrade a unit to archer at the given position
   */
  async upgradeArcher({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    await this.sendAction({
      type: "upgrade",
      player: this.currentPlayer,
      position: tilePosition,
      targetType: PieceType.archer,
    });
  }

  /**
   * Attack a target at the given position
   */
  async attack({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (!tilePosition) return;

    const selectedPosition = this.getSelectedPosition();
    if (!selectedPosition) {
      console.warn("No unit selected to attack with");
      return;
    }

    await this.sendAction({
      type: "attack",
      player: this.currentPlayer,
      position: tilePosition,
      selectedPosition,
    });
  }
}
