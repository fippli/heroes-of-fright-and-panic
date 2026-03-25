/**
 * Take screenshots of the web UI using Playwright.
 *
 * Usage:
 *   pnpm dlx tsx scripts/screenshot.ts [--url <url>] [--out <path>] [--wait <ms>]
 *
 * Defaults:
 *   --url  http://localhost:5173/sandbox
 *   --out  screenshots/screenshot.png
 *   --wait 2000 (ms to wait for rendering)
 *
 * Examples:
 *   pnpm dlx tsx scripts/screenshot.ts
 *   pnpm dlx tsx scripts/screenshot.ts --url http://localhost:5173/map --out screenshots/map.png
 *   pnpm dlx tsx scripts/screenshot.ts --url http://localhost:5173/sandbox --wait 3000
 */

import { chromium } from "playwright";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const args = process.argv.slice(2);

const getArg = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag);
  return index !== -1 ? (args[index + 1] ?? fallback) : fallback;
};

const url = getArg("--url", "http://localhost:5173/sandbox");
const outputPath = getArg("--out", "screenshots/screenshot.png");
const waitMs = Number(getArg("--wait", "2000"));

const run = async (): Promise<void> => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });

  console.log(`Waiting ${waitMs}ms for rendering...`);
  await page.waitForTimeout(waitMs);

  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Screenshot saved: ${outputPath}`);

  await browser.close();
};

run().catch((error) => {
  console.error("Screenshot failed:", error);
  process.exit(1);
});
