import * as hex from "@shared/map/hex";
import type { RiverSegment, TilePosition } from "@shared/map/tile";
import type { ImageAssets } from "../images";
import type { Building } from "./Building";
import { Hexagon } from "./Hexagon";

import { Landscape, LandscapeType } from "./Landscape";
import type { Piece } from "./Piece";

export type { TilePosition };

const tileKey = (tile: TilePosition): string => `${tile.row},${tile.column}`;

export class Tile {
  readonly x: number;
  readonly y: number;
  readonly row: number;
  readonly column: number;
  explored: boolean = false;
  /** A farm next to a homestead or manor: drawn with livestock */
  pasture: boolean = false;
  /** The piece is being dragged: keep its tile drawn but lift the piece off it */
  hidePiece: boolean = false;
  readonly landscape: Landscape | null;
  readonly building?: Building;
  readonly piece?: Piece;
  /** Steed lying on the tile (horse/boat), mounted by moving a piece onto it */
  readonly steed: string | null;
  /** River overlay crossing the tile between two edges */
  readonly river: RiverSegment | null;

  constructor({
    row,
    column,
    explored,
    landscape,
    piece,
    building,
    steed,
    river,
  }: {
    row: number;
    column: number;
    explored?: boolean;
    landscape?: Landscape;
    piece?: Piece;
    building?: Building;
    steed?: string | null;
    river?: RiverSegment | null;
  }) {
    this.piece = piece;
    this.building = building;
    this.steed = steed ?? null;
    this.river = river ?? null;
    this.x = Hexagon.x(row, column);
    this.y = Hexagon.y(row);
    this.row = row;
    this.column = column;
    this.explored = explored ?? false;
    this.landscape = landscape ?? null;
  }

  /**
   * Whether this tile was discovered earlier but is not in current vision:
   * the server (or an optimistic prediction) gave us terrain data for it,
   * yet no friendly piece can see it right now.
   */
  isRemembered(): boolean {
    return (
      !this.explored &&
      this.landscape !== null &&
      this.landscape.type !== LandscapeType.unexplored
    );
  }

  render(ctx: CanvasRenderingContext2D, imageAssets: ImageAssets) {
    ctx.save();
    ctx.clip(Hexagon.path(this.x, this.y, Hexagon.clipRadius));

    if (this.explored) {
      if (this.landscape !== null) {
        this.landscape.render(ctx, this, imageAssets);
        this.renderRiver(ctx);
        this.building?.render(ctx, this, imageAssets);
        if (this.steed !== null && this.piece === undefined) {
          imageAssets.itemImage(this.steed)?.renderCentered(ctx, this.x, this.y);
        }
        if (!this.hidePiece) this.piece?.render(ctx, this, imageAssets);
      }
    } else if (this.isRemembered()) {
      // Discovered but out of sight: the last-seen terrain, building and
      // waiting steed under a shadow — never pieces (they may have moved,
      // and an enemy could be standing here right now).
      this.landscape?.render(ctx, this, imageAssets);
      this.renderRiver(ctx);
      this.building?.render(ctx, this, imageAssets);
      if (this.steed !== null) {
        imageAssets.itemImage(this.steed)?.renderCentered(ctx, this.x, this.y);
      }
      ctx.fillStyle = "rgba(10, 10, 25, 0.55)";
      ctx.fill(Hexagon.path(this.x, this.y, Hexagon.clipRadius));
    } else {
      Landscape.unexplored(ctx, this.x, this.y, imageAssets);
    }

    ctx.restore();
  }

  /**
   * The river overlay: a stroke from the entry edge's midpoint through the
   * tile center to the exit edge's midpoint. The midpoint of a shared edge is
   * exactly halfway between the two hex centers, so no vertex math is needed.
   */
  private renderRiver(ctx: CanvasRenderingContext2D): void {
    if (this.river === null) return;
    const edgeMid = (direction: number): { x: number; y: number } => {
      const neighbor = hex.neighborAt(this, direction);
      return {
        x: (this.x + Hexagon.x(neighbor.row, neighbor.column)) / 2,
        y: (this.y + Hexagon.y(neighbor.row)) / 2,
      };
    };
    const from = edgeMid(this.river.entry);
    const to = edgeMid(this.river.exit);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(this.x, this.y, to.x, to.y);
    // Shallow banks fading into a dark, deep mid-channel
    ctx.strokeStyle = "#7db3de";
    ctx.lineWidth = Hexagon.height / 4;
    ctx.stroke();
    ctx.strokeStyle = "#4a86bd";
    ctx.lineWidth = Hexagon.height / 6;
    ctx.stroke();
    ctx.strokeStyle = "#27567f";
    ctx.lineWidth = Hexagon.height / 12;
    ctx.stroke();
    ctx.restore();
  }

  renderArea(ctx: CanvasRenderingContext2D, tiles: Tile[]) {
    ctx.save();
    const viewRange = Math.max(
      this.building?.viewRange ?? 0,
      this.piece?.viewRange ?? 0,
    );
    this.getTilesInRange(tiles, viewRange).forEach((tile: Tile) => {
      Hexagon.renderArea(ctx, tile.x, tile.y, "#00ffff11");
    });
    ctx.restore();
  }

  /**
   * Render red overlay on tiles this piece can attack
   */
  renderValidAttacks(
    ctx: CanvasRenderingContext2D,
    tiles: Tile[],
    myPlayerType: "day" | "night" | null,
  ) {
    if (this.piece === undefined || myPlayerType === null) return;

    ctx.save();
    const attackRange = this.piece.attackRange ?? this.piece.viewRange ?? 1;
    const tilesInRange = this.getTilesInRange(tiles, attackRange);

    tilesInRange.forEach((tile) => {
      if (tile.piece !== undefined && tile.piece.owner?.type !== myPlayerType) {
        Hexagon.renderArea(ctx, tile.x, tile.y, "#ff000044");
        Hexagon.render(ctx, tile.x, tile.y, "#ff0000aa");
      }
    });
    ctx.restore();
  }

  renderHovered(ctx: CanvasRenderingContext2D) {
    ctx.save();
    Hexagon.render(ctx, this.x, this.y, "#ff884488");
    ctx.restore();
  }

  isMouseOver(mouseX: number, mouseY: number) {
    return Hexagon.collidesWithCoordinates(mouseX, mouseY, this.x, this.y);
  }

  isNeighborTo(position: TilePosition | null | undefined) {
    if (position == null) return false;
    return hex.isNeighborTo(this, position);
  }

  getNeighbors(tiles: Tile[]) {
    return hex.findNeighbors(this, tiles);
  }

  /**
   * Get all tiles within a given range using BFS.
   * Range 0 = just this tile, Range 1 = this + 6 neighbors, etc.
   * Uses a Set for O(1) visited-tile lookups instead of linear scans.
   */
  getTilesInRange(tiles: Tile[], viewRange: number): Tile[] {
    return Array.from({ length: viewRange }).reduce<{
      result: Tile[];
      currentLayer: Tile[];
      visited: Set<string>;
    }>(
      (acc) => {
        const nextLayer = acc.currentLayer.flatMap((tile) =>
          tile.getNeighbors(tiles).filter((neighbor) => {
            const key = tileKey(neighbor);
            if (acc.visited.has(key)) return false;
            acc.visited.add(key);
            return true;
          }),
        );
        return {
          result: [...acc.result, ...nextLayer],
          currentLayer: nextLayer,
          visited: acc.visited,
        };
      },
      {
        result: [this],
        currentLayer: [this],
        visited: new Set([tileKey(this)]),
      },
    ).result;
  }

  has(tilePosition: TilePosition) {
    return hex.isSamePosition(this, tilePosition);
  }

  distanceTo(compareTile: Tile): number {
    const q1 = this.column - Math.floor((this.row - (this.row & 1)) / 2);
    const r1 = this.row;
    const q2 =
      compareTile.column -
      Math.floor((compareTile.row - (compareTile.row & 1)) / 2);
    const r2 = compareTile.row;

    const dq = q1 - q2;
    const dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
  }

  canWalkOn(tile: Tile) {
    if (tile.landscape === null) return false;
    return this.piece?.walkableLandscape.includes(tile.landscape.type) ?? false;
  }

}
