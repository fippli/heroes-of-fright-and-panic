import { BuildingType } from "../core/Building";
import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { LandscapeType } from "../core/Landscape";
import { PieceKind } from "../core/Piece";
import type { Player } from "../core/Player";
import { themesApi, type ThemeAsset } from "../lib/theme-api";

const pieceAssetKey = (player: Player, kind: PieceKind): string => {
  const playerSuffix = player.type === "day" ? "day" : "night";
  switch (kind) {
    case PieceKind.peasant:
      return `peasant_${playerSuffix}`;
    case PieceKind.king:
      return `king_${playerSuffix}`;
    case PieceKind.priest:
      return `priest_${playerSuffix}`;
    case PieceKind.archAngel:
      return `archAngel_${playerSuffix}`;
    default:
      return "";
  }
};

const buildingAssetKey = (player: Player, type: BuildingType): string => {
  const playerSuffix = player.type === "day" ? "day" : "night";
  switch (type) {
    case BuildingType.house:
      return `house_${playerSuffix}`;
    case BuildingType.castle:
      return `castle_${playerSuffix}`;
    case BuildingType.tower:
      return `tower_${playerSuffix}`;
    case BuildingType.wall:
      return `wall_${playerSuffix}`;
    case BuildingType.church:
      return `church_${playerSuffix}`;
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
    case LandscapeType.farm:
      return "farm";
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

  pieceImage(player: Player, kind: PieceKind): GameImage | undefined {
    const key = `piece/${pieceAssetKey(player, kind)}`;
    return this.imageCache.get(key);
  }

  buildingImage(player: Player, type: BuildingType): GameImage | undefined {
    const key = `building/${buildingAssetKey(player, type)}`;
    return this.imageCache.get(key);
  }

  landscapeImage(type: LandscapeType): GameImage | undefined {
    const key = `landscape/${landscapeAssetKey(type)}`;
    return this.imageCache.get(key);
  }
}
