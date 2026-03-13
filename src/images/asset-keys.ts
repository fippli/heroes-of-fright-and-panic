type AssetCategory = "piece" | "building" | "landscape";

type AssetSlot = {
  readonly category: AssetCategory;
  readonly key: string;
  readonly label: string;
};

export const ASSET_SLOTS: readonly AssetSlot[] = [
  // Pieces
  { category: "piece", key: "peasant_day", label: "Peasant (Day)" },
  { category: "piece", key: "peasant_night", label: "Peasant (Night)" },
  { category: "piece", key: "knight_day", label: "Knight (Day)" },
  { category: "piece", key: "knight_night", label: "Knight (Night)" },
  { category: "piece", key: "soldier_day", label: "Soldier (Day)" },
  { category: "piece", key: "soldier_night", label: "Soldier (Night)" },
  { category: "piece", key: "archer_day", label: "Archer (Day)" },
  { category: "piece", key: "archer_night", label: "Archer (Night)" },
  { category: "piece", key: "boat", label: "Boat (Piece)" },

  // Buildings
  { category: "building", key: "house", label: "House" },
  { category: "building", key: "castle", label: "Castle" },
  { category: "building", key: "tower", label: "Tower" },
  { category: "building", key: "boat", label: "Boat (Building)" },
  { category: "building", key: "farm", label: "Farm" },

  // Landscape
  { category: "landscape", key: "unexplored", label: "Unexplored" },
  { category: "landscape", key: "grass", label: "Grass" },
  { category: "landscape", key: "tree", label: "Tree" },
  { category: "landscape", key: "sand", label: "Sand" },
  { category: "landscape", key: "water", label: "Water" },
  { category: "landscape", key: "mountain", label: "Mountain" },
] as const;

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  "piece",
  "building",
  "landscape",
] as const;

export const getSlotsByCategory = (
  category: AssetCategory,
): readonly AssetSlot[] =>
  ASSET_SLOTS.filter((slot) => slot.category === category);
