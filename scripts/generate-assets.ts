/**
 * Generate the game's sprite set with PixelLab and optionally upload it as a
 * theme.
 *
 *   pnpm assets:generate [--style default|paper] [--lofi] [--variants 2] [--concurrency 6] [--size 128]
 *                        [--only king_day,grass] [--out generated/assets]
 *   pnpm assets:upload --theme "Dusk and Dawn v1" [--out generated/assets]
 *                      [--picks generated/assets/picks.json]
 *
 * The PixelLab key is read from PIXELLAB_API_KEY or the desktop app's
 * settings (~/.config/com.fippli.pixellab/settings.json). Upload needs
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 *
 * picks.json maps asset key -> variant number (1-based); unlisted keys use
 * variant 1.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ASSET_SLOTS, type AssetCategory } from "../src/images/asset-keys";

// ----------------------------------------------------------------------------
// CLI + env
// ----------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};

const loadDotEnv = (): void => {
  const file = path.resolve(".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match !== null && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
};
loadDotEnv();

const readPixellabKey = (): string => {
  const fromEnv = process.env.PIXELLAB_API_KEY;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const settings = path.join(os.homedir(), ".config", "com.fippli.pixellab", "settings.json");
  const parsed = JSON.parse(fs.readFileSync(settings, "utf-8")) as { api_key?: string };
  if (parsed.api_key === undefined) throw new Error("No PixelLab API key found");
  return parsed.api_key;
};

const style = flag("--style", "default");
const lofi = args.includes("--lofi");
const outDir = path.resolve(
  flag("--out", style === "paper" ? (lofi ? "generated/paper32" : "generated/paper") : "generated/assets"),
);
const size = Number(flag("--size", lofi ? "32" : "128"));
// Request a larger canvas than the target (terrain gets center-cropped afterwards)
const genSize = Number(flag("--gen-size", String(size)));
const variants = Number(flag("--variants", "2"));
const concurrency = Number(flag("--concurrency", "6"));
const only = flag("--only", "")
  .split(",")
  .map((key) => key.trim())
  .filter((key) => key !== "");

// ----------------------------------------------------------------------------
// Prompts
// ----------------------------------------------------------------------------

const STYLE = {
  outline: "single color black outline",
  shading: "detailed shading",
  detail: "highly detailed",
} as const;

const DAY = "Day alliance, human, warm golden and cream colours, sunlit";
const NIGHT = "Night alliance, undead, pale bone and deep violet colours, moonlit";

type Prompt = {
  readonly description: string;
  readonly view: "side" | "low top-down" | "high top-down";
  readonly noBackground: boolean;
};

const piece = (day: string, night: string): Record<"day" | "night", string> => ({
  day: `${day}, ${DAY}`,
  night: `${night}, ${NIGHT}`,
});

const PIECES: Record<string, Record<"day" | "night", string>> = {
  peasant: piece(
    "a medieval peasant villager in a tunic holding a wooden pitchfork, full body",
    "a skeleton peasant in rags holding a rusty pitchfork, full body",
  ),
  king: piece(
    "a king in ornate gilded armour with a golden crown and a sceptre, full body",
    "a skeletal lich king in dark armour with a crown of bone and a cursed sceptre, full body",
  ),
  priest: piece(
    "a hooded priest in white robes holding a glowing holy staff, full body",
    "a hooded skeletal cultist priest in black robes holding a dark crystal staff, full body",
  ),
  archAngel: piece(
    "an armoured archangel with large white feathered wings and a flaming sword, full body",
    "a fallen angel with tattered bat wings and a dark flaming sword, full body",
  ),
};

const ITEMS: Record<string, string> = {
  sword: "a steel longsword with a leather grip, item icon",
  shield: "a round wooden shield with an iron boss, item icon",
  bow: "a curved wooden recurve bow with a taut bowstring, no arrow, held upright, item icon",
  horse: "a saddled brown horse standing, full body",
  boat: "a small wooden rowing boat with oars",
};

const BUILDINGS: Record<string, Record<"day" | "night", string>> = {
  house: piece(
    "a small medieval cottage with a thatched roof and a chimney",
    "a crooked haunted hut with a sagging roof and glowing violet windows",
  ),
  castle: piece(
    "a stone castle keep with towers, battlements and a golden banner",
    "a dark gothic castle with jagged black towers and violet banners",
  ),
  tower: piece(
    "a tall stone watchtower with a wooden lookout platform",
    "a crooked dark obsidian watchtower with a glowing violet beacon",
  ),
  wall: piece(
    "a single straight section of grey stone castle wall with battlements, spanning the full width, no towers",
    "a single straight section of dark spiked bone wall with skulls, spanning the full width, no towers",
  ),
  church: piece(
    "a small stone chapel with a steeple and a golden cross",
    "a dark shrine with a spire and a violet flame on top",
  ),
};

const LANDSCAPE: Record<string, string> = {
  unexplored: "dark swirling fog and clouds, seamless top-down terrain tile texture, muted grey",
  grass: "uniform lush green meadow grass with a few tiny flowers, seamless repeating top-down terrain texture filling the entire canvas edge to edge, no border, no frame",
  farm: "tilled farmland with rows of golden wheat, seamless top-down terrain tile texture",
  tree: "dense forest canopy of green trees seen from above, seamless top-down terrain tile texture",
  sand: "golden desert sand with soft dunes, seamless top-down terrain tile texture",
  water: "deep blue sea water with light ripples and foam, seamless top-down terrain tile texture",
  mountain: "grey rocky mountain peaks with snowy tops seen from above, seamless top-down terrain tile texture",
};

// ---- "Fantasy paper map" style: sepia parchment, ink linework, map icons ----

const PAPER_SUFFIX =
  "fantasy paper map style, hand-drawn ink linework on aged parchment, sepia and muted earth tones, illustrative, clean";
const PAPER_DAY = "Day alliance, warm ochre and cream accents";
const PAPER_NIGHT = "Night alliance, dark ink and muted violet accents";

const paperPiece = (day: string, night: string): Record<"day" | "night", string> => ({
  day: `${day}, ${PAPER_DAY}, ${PAPER_SUFFIX}`,
  night: `${night}, ${PAPER_NIGHT}, ${PAPER_SUFFIX}`,
});

const PAPER_PIECES: Record<string, Record<"day" | "night", string>> = {
  peasant: paperPiece(
    "a small map figure of a medieval peasant with a pitchfork, full body",
    "a small map figure of a skeleton peasant with a rusty pitchfork, full body",
  ),
  king: paperPiece(
    "a small map figure of a crowned king in armour with a sceptre, full body",
    "a small map figure of a skeletal lich king with a bone crown and cursed sceptre, full body",
  ),
  priest: paperPiece(
    "a small map figure of a hooded priest with a glowing staff, full body",
    "a small map figure of a hooded skeletal cultist with a dark staff, full body",
  ),
  archAngel: paperPiece(
    "a small map figure of an armoured angel with feathered wings and a flaming sword, full body",
    "a small map figure of a fallen angel with tattered bat wings and a dark sword, full body",
  ),
};

const ICONS: Record<string, string> = {
  wood: "a small pile of two cut logs, resource icon",
  stone: "a grey stone block, resource icon",
  food: "a loaf of bread with a wheat sprig, resource icon",
  gold: "a stack of gold coins, resource icon",
  iron: "an iron ingot bar, resource icon",
  faith: "a glowing halo over praying hands, resource icon",
};

const PAPER_ITEMS: Record<string, string> = {
  sword: `an ink-drawn map icon of a longsword, ${PAPER_SUFFIX}`,
  shield: `an ink-drawn map icon of a round wooden shield, ${PAPER_SUFFIX}`,
  bow: `a single curved wooden recurve bow with a taut bowstring, no arrow, isolated object on a fully transparent background, no paper, no parchment, no frame, ${PAPER_SUFFIX}`,
  horse: `a small map figure of a saddled horse, full body, ${PAPER_SUFFIX}`,
  boat: `an ink-drawn map icon of a small wooden sailing boat, ${PAPER_SUFFIX}`,
};

const PAPER_BUILDINGS: Record<string, Record<"day" | "night", string>> = {
  house: paperPiece(
    "a hand-drawn map icon of a small thatched cottage with a chimney",
    "a hand-drawn map icon of a crooked haunted hut with a sagging roof",
  ),
  castle: paperPiece(
    "a hand-drawn map icon of a stone castle with towers, battlements and a banner",
    "a hand-drawn map icon of a dark gothic castle with jagged towers",
  ),
  tower: paperPiece(
    "a hand-drawn map icon of a tall stone watchtower with a wooden lookout",
    "a hand-drawn map icon of a crooked dark watchtower with a beacon",
  ),
  wall: paperPiece(
    "a hand-drawn map icon of a single straight stone wall section with battlements spanning the full width, no towers",
    "a hand-drawn map icon of a single straight spiked bone wall section spanning the full width, no towers",
  ),
  church: paperPiece(
    "a hand-drawn map icon of a small stone chapel with a steeple and cross",
    "a hand-drawn map icon of a dark shrine with a spire",
  ),
};

const PAPER_LANDSCAPE: Record<string, string> = {
  unexplored: `blank aged parchment paper with faint ink fog swirls, seamless texture filling the entire canvas, ${PAPER_SUFFIX}`,
  grass: `open meadow covering the entire canvas: aged parchment with a uniform faint green wash and scattered small hand-drawn ink grass tufts everywhere, no border, no frame, ${PAPER_SUFFIX}`,
  farm: `aged parchment paper with hand-drawn ink crop rows and a faint ochre wash, seamless texture filling the entire canvas, no border, ${PAPER_SUFFIX}`,
  tree: `a cluster of hand-drawn ink pine and oak trees with a muted green wash, map icon, ${PAPER_SUFFIX}`,
  sand: `open desert covering the entire canvas: aged parchment with a uniform faint ochre wash and scattered small hand-drawn ink dune strokes and dots everywhere, no border, no frame, ${PAPER_SUFFIX}`,
  water: `open sea covering the entire canvas: aged parchment with a uniform muted blue-grey wash and small hand-drawn ink wave marks everywhere, no land, no coastline, no border, ${PAPER_SUFFIX}`,
  mountain: `a cluster of hand-drawn ink mountain peaks with hatched shaded sides, map icon, ${PAPER_SUFFIX}`,
};

const PAPER_ICON_TERRAIN = new Set(["tree", "mountain"]);

const paperPromptFor = (category: AssetCategory, key: string): Prompt => {
  if (category === "icon") {
    return { description: `an ink-drawn map icon of ${ICONS[key]}, ${PAPER_SUFFIX}`, view: "side", noBackground: true };
  }
  if (category === "landscape") {
    const icon = PAPER_ICON_TERRAIN.has(key);
    return {
      description: PAPER_LANDSCAPE[key],
      view: icon ? "low top-down" : "high top-down",
      noBackground: icon,
    };
  }
  const match = /^(.+)_(day|night)$/.exec(key);
  if (category === "building" && match !== null) {
    return { description: PAPER_BUILDINGS[match[1]][match[2] as "day" | "night"], view: "low top-down", noBackground: true };
  }
  if (match !== null) {
    return { description: PAPER_PIECES[match[1]][match[2] as "day" | "night"], view: "low top-down", noBackground: true };
  }
  return { description: PAPER_ITEMS[key], view: "low top-down", noBackground: true };
};

const LOFI_SUFFIX =
  "extremely simple minimal pixel art icon, blocky, flat colours, only 3 or 4 colours, no fine details, thin dark outline, muted parchment palette, no background";

// Lo-fi: keep only the subject clause of the paper prompt and a short faction hint
const lofiPromptFor = (category: AssetCategory, key: string): Prompt => {
  const paper = paperPromptFor(category, key);
  const subject = paper.description.split(", ")[0].replace(/^(a |an )?(hand-drawn |ink-drawn )?(map icon of |small map figure of )?/, "");
  const faction = key.endsWith("_night") ? "dark ink and violet" : key.endsWith("_day") ? "warm ochre" : "";
  const description = [subject, faction, LOFI_SUFFIX].filter((part) => part !== "").join(", ");
  return { ...paper, description };
};

const promptFor = (category: AssetCategory, key: string): Prompt => {
  if (style === "paper" && lofi) return lofiPromptFor(category, key);
  if (style === "paper") return paperPromptFor(category, key);
  if (category === "icon") {
    return { description: ICONS[key], view: "side", noBackground: true };
  }
  if (category === "landscape") {
    return { description: LANDSCAPE[key], view: "high top-down", noBackground: false };
  }
  const match = /^(.+)_(day|night)$/.exec(key);
  if (category === "building" && match !== null) {
    return {
      description: BUILDINGS[match[1]][match[2] as "day" | "night"],
      view: "low top-down",
      noBackground: true,
    };
  }
  if (match !== null) {
    return {
      description: PIECES[match[1]][match[2] as "day" | "night"],
      view: "low top-down",
      noBackground: true,
    };
  }
  return { description: ITEMS[key], view: "low top-down", noBackground: true };
};

// Stable seed per key so re-runs reproduce the same variants
const seedFor = (key: string, variant: number): number => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 1_000_000) * 10 + variant;
};

// ----------------------------------------------------------------------------
// Generation
// ----------------------------------------------------------------------------

type Job = {
  readonly category: AssetCategory;
  readonly key: string;
  readonly variant: number;
  readonly prompt: Prompt;
  readonly file: string;
};

const paletteImage = (): { type: "base64"; base64: string } | undefined => {
  const file = path.join(outDir, "palette.png");
  if (!fs.existsSync(file)) return undefined;
  return { type: "base64", base64: fs.readFileSync(file).toString("base64") };
};

const generateOne = async (apiKey: string, job: Job): Promise<number> => {
  const paper = style === "paper";
  const palette = paper ? paletteImage() : undefined;
  const body = {
    description: `${job.prompt.description}, pixel art`,
    image_size: { width: genSize, height: genSize },
    text_guidance_scale: 8,
    outline: paper ? "single color outline" : STYLE.outline,
    shading: lofi ? "flat shading" : paper ? "medium shading" : STYLE.shading,
    detail: lofi ? "low detail" : paper ? "medium detail" : STYLE.detail,
    view: job.prompt.view,
    isometric: false,
    no_background: job.prompt.noBackground,
    seed: seedFor(job.key, job.variant),
    ...(palette !== undefined ? { color_image: palette } : {}),
  };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        image: { base64: string };
        usage?: { usd?: number };
      };
      const base64 = data.image.base64.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(job.file, Buffer.from(base64, "base64"));
      fs.writeFileSync(
        job.file.replace(/\.png$/, ".json"),
        JSON.stringify(
          { ...body, color_image: palette !== undefined ? "palette.png" : undefined, category: job.category, key: job.key, variant: job.variant },
          null,
          2,
        ),
      );
      return data.usage?.usd ?? 0;
    }
    const text = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 4) {
      throw new Error(`${job.key} v${job.variant}: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
  throw new Error("unreachable");
};

const runPool = async <T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>) => {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
};

const generate = async (): Promise<void> => {
  const apiKey = readPixellabKey();
  fs.mkdirSync(outDir, { recursive: true });
  const slots = ASSET_SLOTS.filter((slot) => only.length === 0 || only.includes(slot.key));
  const jobs: Job[] = slots.flatMap((slot) =>
    Array.from({ length: variants }, (_, index) => ({
      category: slot.category,
      key: slot.key,
      variant: index + 1,
      prompt: promptFor(slot.category, slot.key),
      file: path.join(outDir, `${slot.key}-v${index + 1}.png`),
    })),
  );
  const pending = jobs.filter((job) => !fs.existsSync(job.file));
  console.log(`${jobs.length} jobs, ${pending.length} to generate (${size}px, concurrency ${concurrency})`);
  let done = 0;
  let totalUsd = 0;
  const failures: string[] = [];
  const started = Date.now();
  await runPool(pending, concurrency, async (job) => {
    try {
      totalUsd += await generateOne(apiKey, job);
      done += 1;
      console.log(`  [${done}/${pending.length}] ${job.key} v${job.variant}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  });
  console.log(`done: ${done} generated, ${failures.length} failed, ~$${totalUsd.toFixed(3)} credits (0 if on subscription)`);
  failures.forEach((failure) => console.error("  FAIL", failure));
  if (failures.length > 0) process.exit(1);
};

// ----------------------------------------------------------------------------
// Upload as theme
// ----------------------------------------------------------------------------

const upload = async (): Promise<void> => {
  const themeName = flag("--theme", "");
  if (themeName === "") throw new Error("--theme <name> is required");
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || serviceKey === undefined) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env)");
  }
  const picksFile = flag("--picks", path.join(outDir, "picks.json"));
  const picks: Record<string, number> = fs.existsSync(picksFile)
    ? (JSON.parse(fs.readFileSync(picksFile, "utf-8")) as Record<string, number>)
    : {};

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Reuse the theme if it exists, else create it
  const existing = await supabase.from("themes").select("id").eq("name", themeName).maybeSingle();
  let themeId = existing.data?.id as string | undefined;
  if (themeId === undefined) {
    const created = await supabase
      .from("themes")
      .insert({
        name: themeName,
        description: `Generated with PixelLab (${size}px) by scripts/generate-assets.ts`,
        created_by: "scripts/generate-assets.ts",
      })
      .select("id")
      .single();
    if (created.error !== null) throw new Error(created.error.message);
    themeId = created.data.id as string;
    console.log(`created theme "${themeName}" (${themeId})`);
  } else {
    console.log(`updating existing theme "${themeName}" (${themeId})`);
  }

  let uploaded = 0;
  const missing: string[] = [];
  for (const slot of ASSET_SLOTS) {
    const variant = picks[slot.key] ?? 1;
    const file = path.join(outDir, `${slot.key}-v${variant}.png`);
    if (!fs.existsSync(file)) {
      missing.push(`${slot.key} (v${variant})`);
      continue;
    }
    const storagePath = `${themeId}/${slot.category}/${slot.key}.png`;
    const { error: uploadError } = await supabase.storage
      .from("theme-assets")
      .upload(storagePath, fs.readFileSync(file), { upsert: true, contentType: "image/png" });
    if (uploadError !== null) throw new Error(`${slot.key}: ${uploadError.message}`);
    const { error: rowError } = await supabase.from("theme_assets").upsert(
      { theme_id: themeId, category: slot.category, asset_key: slot.key, storage_path: storagePath },
      { onConflict: "theme_id,category,asset_key" },
    );
    if (rowError !== null) throw new Error(`${slot.key}: ${rowError.message}`);
    uploaded += 1;
  }
  console.log(`uploaded ${uploaded}/${ASSET_SLOTS.length} assets to theme ${themeId}`);
  if (missing.length > 0) console.warn("missing files:", missing.join(", "));
};

if (command === "generate") {
  await generate();
} else if (command === "upload") {
  await upload();
} else {
  console.error("Usage: generate-assets.ts generate|upload [options]");
  process.exit(2);
}
