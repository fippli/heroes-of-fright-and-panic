import { BuildingType } from "../core/Building";
import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { LandscapeType } from "../core/Landscape";
import { PieceType } from "../core/Piece";
import type { Player } from "../core/Player";
import { themesApi, type ThemeAsset } from "../lib/theme-api";

const pieceAssetKey = (player: Player, type: PieceType): string => {
  const playerSuffix = player.type === "day" ? "day" : "night";
  switch (type) {
    case PieceType.peasant:
      return `peasant_${playerSuffix}`;
    case PieceType.knight:
      return `knight_${playerSuffix}`;
    case PieceType.soldier:
      return `soldier_${playerSuffix}`;
    case PieceType.archer:
      return `archer_${playerSuffix}`;
    case PieceType.boat:
      return "boat";
    default:
      return "";
  }
};

const buildingAssetKey = (type: BuildingType): string => {
  switch (type) {
    case BuildingType.house:
      return "house";
    case BuildingType.castle:
      return "castle";
    case BuildingType.tower:
      return "tower";
    case BuildingType.boat:
      return "boat";
    case BuildingType.farm:
      return "farm";
    default:
      return "";
  }
};

const landscapeAssetKey = (type: LandscapeType): string => {
  switch (type) {
    case LandscapeType.unexplored:
      return "unexplored";
    case LandscapeType.grass:
      return "grass";
    case LandscapeType.tree:
      return "tree";
    case LandscapeType.sand:
      return "sand";
    case LandscapeType.water:
      return "water";
    case LandscapeType.mountain:
      return "mountain";
    default:
      return "";
  }
};

const createGameImage = (url: string): GameImage =>
  new GameImage({
    src: url,
    width: Hexagon.width,
    height: Hexagon.height,
  });

export class ThemeImageAssets {
  private readonly imageCache: ReadonlyMap<string, GameImage>;

  constructor(assets: readonly ThemeAsset[]) {
    const entries: [string, GameImage][] = assets.map((asset) => {
      const url = themesApi.getPublicUrl(asset.storagePath);
      const cacheKey = `${asset.category}/${asset.assetKey}`;
      return [cacheKey, createGameImage(url)];
    });
    this.imageCache = new Map(entries);
  }

  static async fromThemeId(
    themeId: string,
  ): Promise<ThemeImageAssets> {
    const assets = await themesApi.getAssets(themeId);
    return new ThemeImageAssets(assets);
  }

  pieceImage(player: Player, type: PieceType): GameImage | undefined {
    const key = `piece/${pieceAssetKey(player, type)}`;
    return this.imageCache.get(key);
  }

  buildingImage(type: BuildingType): GameImage | undefined {
    const key = `building/${buildingAssetKey(type)}`;
    return this.imageCache.get(key);
  }

  landscapeImage(type: LandscapeType): GameImage | undefined {
    const key = `landscape/${landscapeAssetKey(type)}`;
    return this.imageCache.get(key);
  }
}
