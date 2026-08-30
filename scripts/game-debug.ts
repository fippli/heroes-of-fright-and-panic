/**
 * Query the open `game-debug` edge function from the terminal.
 *
 * Usage:
 *   pnpm dlx tsx scripts/game-debug.ts list [--limit 10]
 *   pnpm dlx tsx scripts/game-debug.ts get <gameId> [--as day|night] [--summary]
 *   pnpm dlx tsx scripts/game-debug.ts events <gameId>
 *   pnpm dlx tsx scripts/game-debug.ts replay <gameId>
 *   pnpm dlx tsx scripts/game-debug.ts errors [<gameId>] [--limit 20]
 *
 * SUPABASE_URL overrides the project URL (defaults to the project in
 * supabase/config.toml).
 */
import * as fs from "node:fs";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
};

const projectRef =
  /project_id\s*=\s*"([^"]+)"/.exec(
    fs.readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf-8"),
  )?.[1] ?? "";
const baseUrl = process.env.SUPABASE_URL ?? `https://${projectRef}.supabase.co`;

const [action, gameId] = args;
const url = new URL(`${baseUrl}/functions/v1/game-debug`);
if (action === "list") {
  url.searchParams.set("action", "list");
  url.searchParams.set("limit", flag("--limit") ?? "10");
} else if ((action === "events" || action === "replay") && gameId !== undefined) {
  url.searchParams.set("action", action);
  url.searchParams.set("gameId", gameId);
} else if (action === "errors") {
  url.searchParams.set("action", "errors");
  url.searchParams.set("limit", flag("--limit") ?? "20");
  if (gameId !== undefined && !gameId.startsWith("--")) url.searchParams.set("gameId", gameId);
} else if (action === "get" && gameId !== undefined) {
  url.searchParams.set("action", "get");
  url.searchParams.set("gameId", gameId);
  const as = flag("--as");
  if (as !== null) url.searchParams.set("as", as);
} else {
  console.error("Usage: game-debug.ts list [--limit n] | get <gameId> [--as day|night] [--summary] | events <gameId> | replay <gameId> | errors [<gameId>]");
  process.exit(2);
}

const response = await fetch(url);
const data = (await response.json()) as Record<string, unknown>;
if (!response.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
const output = args.includes("--summary") && "summary" in data
  ? { engineVersion: data.engineVersion, as: data.as, summary: data.summary }
  : data;
console.log(JSON.stringify(output, null, 2));
