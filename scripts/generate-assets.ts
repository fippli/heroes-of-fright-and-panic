/**
 * Generate the game's sprite set with PixelLab and optionally upload it as a
 * theme.
 *
 *   pnpm assets:generate [--variants 2] [--concurrency 6] [--size 128]
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

const outDir = path.resolve(flag("--out", "generated/assets"));
const size = Number(flag("--size", "128"));
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

const promptFor = (category: AssetCategory, key: string): Prompt => {
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

const generateOne = async (apiKey: string, job: Job): Promise<number> => {
  const body = {
    description: `${job.prompt.description}, pixel art`,
    image_size: { width: size, height: size },
    text_guidance_scale: 8,
    outline: STYLE.outline,
    shading: STYLE.shading,
    detail: STYLE.detail,
    view: job.prompt.view,
    isometric: false,
    no_background: job.prompt.noBackground,
    seed: seedFor(job.key, job.variant),
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
        JSON.stringify({ ...body, category: job.category, key: job.key, variant: job.variant }, null, 2),
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
