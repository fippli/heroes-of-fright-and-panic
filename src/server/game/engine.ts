import type { Game } from "../database";
import type { Tile } from "@shared/map/tile";
import type { TilePosition, PlayerType, ActionResult } from "@shared/actions";
import { GameMap } from "@shared/map/map";
import { Piece, PieceType } from "@shared/piece";
import { Building, BuildingType } from "@shared/building";
import { Player } from "@shared/player";
import { ResourceMap } from "@shared/player/resource-map";
import { LandscapeType, Landscape } from "@shared/map/landscape";
import type { WithId } from "mongodb";

/**
 * GameEngine handles all game logic on the server side.
 * The client should only render state and send user inputs.
 */
export class GameEngine {
  private game: WithId<Game>;

  constructor(game: WithId<Game>) {
    this.game = game;
  }

  // ============================================
  // CLOCK / TIME MANAGEMENT
  // ============================================

  private tick(): void {
    this.game.clock.time = (this.game.clock.time + 1) % 24;
    this.checkTimeTransitions();
  }

  private isDay(): boolean {
    return this.game.clock.time >= 6 && this.game.clock.time < 18;
  }

  private isNight(): boolean {
    return !this.isDay();
  }

  private checkTimeTransitions(): void {
    // Check for dawn (transition to day)
    if (this.isDay() && !this.game.clock.hasDawned) {
      this.onDawn();
      this.game.clock.hasDawned = true;
      this.game.clock.hasDusked = false;
    }

    // Check for dusk (transition to night)
    if (this.isNight() && !this.game.clock.hasDusked) {
      this.onDusk();
      this.game.clock.hasDusked = true;
      this.game.clock.hasDawned = false;
    }

    // Update current player based on time
    this.game.currentPlayer = this.isDay() ? "day" : "night";
  }

  private onDawn(): void {
    // Day player produces resources at dawn
    const production = this.produceResources(this.game.dayPlayer);
    this.game.dayPlayer.resources = this.addResources(
      this.game.dayPlayer.resources,
      production,
    );
  }

  private onDusk(): void {
    // Night player produces resources at dusk
    const production = this.produceResources(this.game.nightPlayer);
    this.game.nightPlayer.resources = this.addResources(
      this.game.nightPlayer.resources,
      production,
    );
  }

  // ============================================
  // RESOURCE MANAGEMENT
  // ============================================

  private produceResources(player: Player): ResourceMap {
    // Find active farms: farms adjacent to houses that have a peasant owned by this player
    const housesWithPeasants = this.game.tiles.filter(
      (tile) =>
        tile.building?.type === BuildingType.house &&
        tile.piece?.type === PieceType.peasant &&
        tile.piece?.owner?.type === player.type,
    );

    const activeFarms = housesWithPeasants.flatMap((houseTile) => {
      const neighbors = this.getNeighbors(houseTile);
      return neighbors.filter(
        (tile) =>
          tile.building?.type === BuildingType.farm &&
          tile.building?.owner?.type === player.type,
      );
    });

    const foodProduction = activeFarms.reduce((acc, farm) => {
      return acc + (farm.building?.production?.food ?? 0);
    }, 0);

    return new ResourceMap({ food: foodProduction });
  }

  private addResources(current: ResourceMap, toAdd: ResourceMap): ResourceMap {
    return new ResourceMap({
      wood: (current.wood ?? 0) + (toAdd.wood ?? 0),
      stone: (current.stone ?? 0) + (toAdd.stone ?? 0),
      gold: (current.gold ?? 0) + (toAdd.gold ?? 0),
      food: (current.food ?? 0) + (toAdd.food ?? 0),
    });
  }

  private subtractResources(
    current: ResourceMap,
    toSubtract: ResourceMap,
  ): ResourceMap {
    return new ResourceMap({
      wood: (current.wood ?? 0) - (toSubtract.wood ?? 0),
      stone: (current.stone ?? 0) - (toSubtract.stone ?? 0),
      gold: (current.gold ?? 0) - (toSubtract.gold ?? 0),
      food: (current.food ?? 0) - (toSubtract.food ?? 0),
    });
  }

  private canAfford(player: Player, cost: ResourceMap): boolean {
    return (
      (player.resources.wood ?? 0) >= (cost.wood ?? 0) &&
      (player.resources.stone ?? 0) >= (cost.stone ?? 0) &&
      (player.resources.gold ?? 0) >= (cost.gold ?? 0) &&
      (player.resources.food ?? 0) >= (cost.food ?? 0)
    );
  }

  private getPlayer(playerType: PlayerType): Player {
    return playerType === "day" ? this.game.dayPlayer : this.game.nightPlayer;
  }

  private updatePlayer(playerType: PlayerType, player: Player): void {
    if (playerType === "day") {
      this.game.dayPlayer = player;
    } else {
      this.game.nightPlayer = player;
    }
  }

  // ============================================
  // TILE UTILITIES
  // ============================================

  private findTile(position: TilePosition): Tile | undefined {
    return this.game.tiles.find(
      (tile) => tile.row === position.row && tile.column === position.column,
    );
  }

  private getNeighbors(tile: Tile | TilePosition): Tile[] {
    return this.game.tiles.filter((t) =>
      GameMap.isNeighborTo(t, { row: tile.row, column: tile.column }),
    );
  }

  private replaceTile(newTile: Tile): void {
    this.game.tiles = this.game.tiles.map((t) =>
      t.row === newTile.row && t.column === newTile.column ? newTile : t,
    );
  }

  private getTilesInRange(
    center: TilePosition,
    range: number,
  ): TilePosition[] {
    const result: TilePosition[] = [center];
    let currentLayer = [center];

    for (let i = 0; i < range; i++) {
      const nextLayer: TilePosition[] = [];
      for (const pos of currentLayer) {
        const neighbors = this.getNeighbors(pos);
        for (const neighbor of neighbors) {
          const alreadyIncluded = result.some(
            (r) => r.row === neighbor.row && r.column === neighbor.column,
          );
          if (!alreadyIncluded) {
            result.push({ row: neighbor.row, column: neighbor.column });
            nextLayer.push({ row: neighbor.row, column: neighbor.column });
          }
        }
      }
      currentLayer = nextLayer;
    }

    return result;
  }

  // ============================================
  // ACTION HANDLERS
  // ============================================

  /**
   * Handle a click action - selecting tiles, moving pieces, looting
   */
  handleClick(
    playerType: PlayerType,
    position: TilePosition,
    selectedPosition?: TilePosition,
  ): ActionResult {
    // Validate it's this player's turn
    if (this.game.currentPlayer !== playerType) {
      return { success: false, error: "Not your turn" };
    }

    const clickedTile = this.findTile(position);
    if (!clickedTile) {
      return { success: false, error: "Invalid tile position" };
    }

    const selectedTile = selectedPosition
      ? this.findTile(selectedPosition)
      : undefined;

    // If clicking on a tile with our piece, just select it (client handles this)
    if (clickedTile.piece?.owner?.type === playerType) {
      return { success: true, message: "Tile selected" };
    }

    // If we have a selected tile with a piece, try to move or loot
    if (selectedTile?.piece?.owner?.type === playerType) {
      const isNeighbor = GameMap.isNeighborTo(clickedTile, selectedTile);

      if (!isNeighbor) {
        return { success: false, error: "Target tile is not adjacent" };
      }

      // Try to loot
      if (this.canLoot(selectedTile, clickedTile)) {
        return this.performLoot(playerType, selectedTile, clickedTile);
      }

      // Try to move
      if (this.canWalkOn(selectedTile, clickedTile)) {
        return this.performMove(selectedTile, clickedTile);
      }

      return { success: false, error: "Cannot move to or loot this tile" };
    }

    return { success: true, message: "Click processed" };
  }

  private canLoot(fromTile: Tile, toTile: Tile): boolean {
    if (!fromTile.piece || !toTile.landscape) return false;
    if (!toTile.landscape.lootDrop) return false;

    const lootableLandscapes = fromTile.piece.lootableLandscape ?? [];
    return lootableLandscapes.includes(toTile.landscape.type);
  }

  private canWalkOn(fromTile: Tile, toTile: Tile): boolean {
    if (!fromTile.piece || !toTile.landscape) return false;
    if (toTile.piece) return false; // Can't walk on occupied tile

    const walkableLandscapes = fromTile.piece.walkableLandscape ?? [];
    return walkableLandscapes.includes(toTile.landscape.type);
  }

  private performLoot(
    playerType: PlayerType,
    fromTile: Tile,
    toTile: Tile,
  ): ActionResult {
    if (!toTile.landscape?.lootDrop) {
      return { success: false, error: "Nothing to loot" };
    }

    const player = this.getPlayer(playerType);
    const lootDrop = toTile.landscape.lootDrop;

    // Add resources to player
    player.resources = this.addResources(player.resources, lootDrop);
    this.updatePlayer(playerType, player);

    // Transform the landscape (tree → grass, mountain → grass)
    const newLandscape = this.transformLandscape(toTile.landscape);
    const updatedTile: Tile = {
      ...toTile,
      landscape: newLandscape,
    };
    this.replaceTile(updatedTile);

    this.tick();
    return {
      success: true,
      message: `Looted ${lootDrop.wood ?? 0} wood, ${lootDrop.stone ?? 0} stone`,
    };
  }

  private transformLandscape(
    landscape: Tile["landscape"],
  ): Tile["landscape"] {
    if (!landscape) return null;

    if (
      landscape.type === LandscapeType.tree ||
      landscape.type === LandscapeType.mountain
    ) {
      return Landscape.grass();
    }
    return landscape;
  }

  private performMove(fromTile: Tile, toTile: Tile): ActionResult {
    if (!fromTile.piece) {
      return { success: false, error: "No piece to move" };
    }

    // Move the piece
    const updatedToTile: Tile = {
      ...toTile,
      piece: fromTile.piece,
    };
    const updatedFromTile: Tile = {
      ...fromTile,
      piece: null,
    };

    this.replaceTile(updatedToTile);
    this.replaceTile(updatedFromTile);

    this.tick();
    return { success: true, message: "Piece moved" };
  }

  /**
   * Handle building construction
   */
  handleBuild(
    playerType: PlayerType,
    buildingType: BuildingType,
    position: TilePosition,
    selectedPosition?: TilePosition,
  ): ActionResult {
    if (this.game.currentPlayer !== playerType) {
      return { success: false, error: "Not your turn" };
    }

    const tile = this.findTile(position);
    if (!tile) {
      return { success: false, error: "Invalid tile position" };
    }

    // Can only build on grass
    if (tile.landscape?.type !== LandscapeType.grass) {
      return { success: false, error: "Can only build on grass" };
    }

    // Can't build if there's already a building
    if (tile.building) {
      return { success: false, error: "Tile already has a building" };
    }

    const player = this.getPlayer(playerType);

    // Check if there's a neighboring piece owned by this player
    const neighbors = this.getNeighbors(tile);
    const hasNeighborPiece = neighbors.some(
      (n) => n.piece?.owner?.type === playerType,
    );

    if (!hasNeighborPiece) {
      return {
        success: false,
        error: "Must build adjacent to one of your pieces",
      };
    }

    // Special rules for farms
    if (buildingType === BuildingType.farm) {
      return this.handleBuildFarm(playerType, position, selectedPosition);
    }

    // Get building cost
    const cost = this.getBuildingCost(buildingType);

    if (!this.canAfford(player, cost)) {
      return { success: false, error: "Cannot afford this building" };
    }

    // Deduct cost
    player.resources = this.subtractResources(player.resources, cost);
    this.updatePlayer(playerType, player);

    // Create building
    const building = this.createBuilding(buildingType, player);
    const updatedTile: Tile = {
      ...tile,
      building,
    };
    this.replaceTile(updatedTile);

    this.tick();
    return { success: true, message: `Built ${buildingType}` };
  }

  private handleBuildFarm(
    playerType: PlayerType,
    position: TilePosition,
    selectedPosition?: TilePosition,
  ): ActionResult {
    const tile = this.findTile(position);
    if (!tile) {
      return { success: false, error: "Invalid tile position" };
    }

    const player = this.getPlayer(playerType);

    // Farm must be adjacent to a house
    const neighbors = this.getNeighbors(tile);
    const isNeighborToHouse = neighbors.some(
      (n) =>
        n.building?.type === BuildingType.house &&
        n.building?.owner?.type === playerType,
    );

    if (!isNeighborToHouse) {
      return { success: false, error: "Farm must be adjacent to your house" };
    }

    // Selected tile must be a house with a peasant
    if (selectedPosition) {
      const selectedTile = this.findTile(selectedPosition);
      if (
        !selectedTile ||
        selectedTile.building?.type !== BuildingType.house ||
        selectedTile.piece?.type !== PieceType.peasant ||
        selectedTile.piece?.owner?.type !== playerType
      ) {
        return {
          success: false,
          error: "Must have a peasant in your house to build a farm",
        };
      }
    }

    const cost = this.getBuildingCost(BuildingType.farm);
    if (!this.canAfford(player, cost)) {
      return { success: false, error: "Cannot afford farm" };
    }

    player.resources = this.subtractResources(player.resources, cost);
    this.updatePlayer(playerType, player);

    const building = this.createBuilding(BuildingType.farm, player);
    const updatedTile: Tile = {
      ...tile,
      building,
    };
    this.replaceTile(updatedTile);

    this.tick();
    return { success: true, message: "Built farm" };
  }

  private getBuildingCost(buildingType: BuildingType): ResourceMap {
    switch (buildingType) {
      case BuildingType.house:
        return new ResourceMap({ wood: 2 });
      case BuildingType.castle:
        return new ResourceMap({ wood: 10, stone: 10 });
      case BuildingType.tower:
        return new ResourceMap({ wood: 1, stone: 3 });
      case BuildingType.farm:
        return new ResourceMap({ wood: 1 });
      case BuildingType.boat:
        return new ResourceMap({});
      default:
        return new ResourceMap({});
    }
  }

  private createBuilding(buildingType: BuildingType, owner: Player): Building {
    switch (buildingType) {
      case BuildingType.house:
        return Building.house(owner);
      case BuildingType.castle:
        return Building.castle(owner);
      case BuildingType.tower:
        return Building.tower(owner);
      case BuildingType.farm:
        return Building.farm(owner);
      case BuildingType.boat:
        return Building.boat(owner);
      default:
        throw new Error(`Unknown building type: ${buildingType}`);
    }
  }

  /**
   * Handle creating a peasant
   */
  handleCreatePeasant(
    playerType: PlayerType,
    position: TilePosition,
  ): ActionResult {
    if (this.game.currentPlayer !== playerType) {
      return { success: false, error: "Not your turn" };
    }

    const tile = this.findTile(position);
    if (!tile) {
      return { success: false, error: "Invalid tile position" };
    }

    // Must be on a house owned by the player
    if (
      tile.building?.type !== BuildingType.house ||
      tile.building?.owner?.type !== playerType
    ) {
      return { success: false, error: "Must create peasant in your house" };
    }

    // Can't create if there's already a piece
    if (tile.piece) {
      return { success: false, error: "Tile already has a unit" };
    }

    const player = this.getPlayer(playerType);
    const cost = Piece.costOfUpgrade(PieceType.peasant);

    if (!this.canAfford(player, cost)) {
      return { success: false, error: "Cannot afford peasant" };
    }

    player.resources = this.subtractResources(player.resources, cost);
    this.updatePlayer(playerType, player);

    const peasant = Piece.peasant(player);
    const updatedTile: Tile = {
      ...tile,
      piece: peasant,
    };
    this.replaceTile(updatedTile);

    this.tick();
    return { success: true, message: "Created peasant" };
  }

  /**
   * Handle upgrading a piece
   */
  handleUpgrade(
    playerType: PlayerType,
    position: TilePosition,
    targetType?: PieceType,
  ): ActionResult {
    if (this.game.currentPlayer !== playerType) {
      return { success: false, error: "Not your turn" };
    }

    const tile = this.findTile(position);
    if (!tile) {
      return { success: false, error: "Invalid tile position" };
    }

    if (!tile.piece || tile.piece.owner?.type !== playerType) {
      return { success: false, error: "No piece to upgrade or not your piece" };
    }

    const player = this.getPlayer(playerType);

    // If targeting archer specifically
    if (targetType === PieceType.archer) {
      const cost = Piece.costOfUpgrade(PieceType.archer);
      if (!this.canAfford(player, cost)) {
        return { success: false, error: "Cannot afford archer upgrade" };
      }

      player.resources = this.subtractResources(player.resources, cost);
      this.updatePlayer(playerType, player);

      const archer = Piece.archer(player);
      const updatedTile: Tile = {
        ...tile,
        piece: archer,
      };
      this.replaceTile(updatedTile);

      return { success: true, message: "Upgraded to archer" };
    }

    // Regular upgrade path: peasant → soldier → knight
    let nextType: PieceType | null = null;
    switch (tile.piece.type) {
      case PieceType.peasant:
        nextType = PieceType.soldier;
        break;
      case PieceType.soldier:
        nextType = PieceType.knight;
        break;
      default:
        return { success: false, error: "Unit cannot be upgraded further" };
    }

    const cost = Piece.costOfUpgrade(nextType);
    if (!this.canAfford(player, cost)) {
      return { success: false, error: `Cannot afford ${nextType} upgrade` };
    }

    player.resources = this.subtractResources(player.resources, cost);
    this.updatePlayer(playerType, player);

    let upgradedPiece: Piece;
    switch (nextType) {
      case PieceType.soldier:
        upgradedPiece = Piece.soldier(player);
        break;
      case PieceType.knight:
        upgradedPiece = Piece.knight(player);
        break;
      default:
        return { success: false, error: "Invalid upgrade target" };
    }

    const updatedTile: Tile = {
      ...tile,
      piece: upgradedPiece,
    };
    this.replaceTile(updatedTile);

    return { success: true, message: `Upgraded to ${nextType}` };
  }

  /**
   * Handle attack action
   */
  handleAttack(
    playerType: PlayerType,
    targetPosition: TilePosition,
    selectedPosition: TilePosition,
  ): ActionResult {
    if (this.game.currentPlayer !== playerType) {
      return { success: false, error: "Not your turn" };
    }

    const selectedTile = this.findTile(selectedPosition);
    const targetTile = this.findTile(targetPosition);

    if (!selectedTile || !targetTile) {
      return { success: false, error: "Invalid tile positions" };
    }

    if (!selectedTile.piece || selectedTile.piece.owner?.type !== playerType) {
      return { success: false, error: "No attacking piece or not your piece" };
    }

    if (!targetTile.piece) {
      return { success: false, error: "No target to attack" };
    }

    if (targetTile.piece.owner?.type === playerType) {
      return { success: false, error: "Cannot attack your own units" };
    }

    // Check range
    const attackerRange = selectedTile.piece.viewRange ?? 1;
    const tilesInRange = this.getTilesInRange(selectedPosition, attackerRange);
    const inRange = tilesInRange.some(
      (t) => t.row === targetPosition.row && t.column === targetPosition.column,
    );

    if (!inRange) {
      return { success: false, error: "Target is out of range" };
    }

    // Destroy the target piece
    const updatedTargetTile: Tile = {
      ...targetTile,
      piece: null,
    };
    this.replaceTile(updatedTargetTile);

    this.tick();
    return { success: true, message: "Attack successful" };
  }

  // ============================================
  // GETTERS
  // ============================================

  getGameState(): WithId<Game> {
    return this.game;
  }

  /**
   * Get the game state filtered for a specific player's perspective.
   * Only tiles that are visible to the player are fully revealed.
   * Other tiles are shown as "unexplored" with no piece/building info.
   */
  getFilteredGameState(forPlayer: PlayerType): WithId<Game> {
    const visibleTilePositions = this.getVisibleTilesForPlayer(forPlayer);

    const filteredTiles = this.game.tiles.map((tile) => {
      const isVisible = visibleTilePositions.some(
        (pos) => pos.row === tile.row && pos.column === tile.column,
      );

      if (isVisible) {
        // Player can see this tile - return full info
        return tile;
      } else {
        // Player cannot see this tile - hide piece and building info
        // but keep the tile coordinates
        return {
          ...tile,
          piece: null,
          building: null,
          landscape: { type: LandscapeType.unexplored, lootDrop: null },
        } as Tile;
      }
    });

    // Return the game state with filtered tiles
    // Only return the player's own resources
    const player = this.getPlayer(forPlayer);

    return {
      ...this.game,
      tiles: filteredTiles,
      // Only expose the current player's own detailed resources
      dayPlayer:
        forPlayer === "day"
          ? this.game.dayPlayer
          : new Player({ type: "day", resources: new ResourceMap({}) }),
      nightPlayer:
        forPlayer === "night"
          ? this.game.nightPlayer
          : new Player({ type: "night", resources: new ResourceMap({}) }),
    };
  }

  /**
   * Get all tile positions visible to a specific player.
   * A player can see tiles:
   * - Where they have a piece (and within that piece's view range)
   * - Where they have a building
   */
  private getVisibleTilesForPlayer(playerType: PlayerType): TilePosition[] {
    const visiblePositions: TilePosition[] = [];

    for (const tile of this.game.tiles) {
      // Check if tile has a piece owned by this player
      if (tile.piece?.owner?.type === playerType) {
        // Add this tile
        visiblePositions.push({ row: tile.row, column: tile.column });

        // Add tiles in view range
        const viewRange = tile.piece.viewRange ?? 1;
        const tilesInRange = this.getTilesInRange(
          { row: tile.row, column: tile.column },
          viewRange,
        );
        visiblePositions.push(...tilesInRange);
      }

      // Check if tile has a building owned by this player
      if (tile.building?.owner?.type === playerType) {
        // Add this tile
        visiblePositions.push({ row: tile.row, column: tile.column });

        // Buildings also have view range
        const viewRange = tile.building.viewRange ?? 1;
        const tilesInRange = this.getTilesInRange(
          { row: tile.row, column: tile.column },
          viewRange,
        );
        visiblePositions.push(...tilesInRange);
      }
    }

    // Deduplicate
    const uniquePositions: TilePosition[] = [];
    for (const pos of visiblePositions) {
      const exists = uniquePositions.some(
        (p) => p.row === pos.row && p.column === pos.column,
      );
      if (!exists) {
        uniquePositions.push(pos);
      }
    }

    return uniquePositions;
  }

  getClockDisplay(): string {
    const hours = this.game.clock.time % 24;
    const hoursString = hours.toString().padStart(2, "0");
    const period = this.isDay() ? "(day)" : "(night)";
    return `${hoursString}:00 ${period}`;
  }
}
