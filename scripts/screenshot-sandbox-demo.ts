/**
 * Take a screenshot of the sandbox with pieces and buildings placed.
 */

import { chromium } from "playwright";
import * as fs from "node:fs/promises";

const run = async (): Promise<void> => {
  await fs.mkdir("screenshots", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log("Loading sandbox...");
  await page.goto("http://localhost:5173/sandbox", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Click "Peasant" tool button, then click on a grass tile
  console.log("Placing day peasant...");
  await page.click('button:text("Peasant")');
  await page.waitForTimeout(200);
  // Click on a tile in the middle of the map
  await page.click("canvas", { position: { x: 350, y: 300 } });
  await page.waitForTimeout(200);

  // Place a king nearby
  console.log("Placing day king...");
  await page.click('button:text("King")');
  await page.waitForTimeout(200);
  await page.click("canvas", { position: { x: 380, y: 280 } });
  await page.waitForTimeout(200);

  // Place a house
  console.log("Placing day house...");
  await page.click('button:text("House")');
  await page.waitForTimeout(200);
  await page.click("canvas", { position: { x: 320, y: 280 } });
  await page.waitForTimeout(200);

  // Switch to night and place pieces
  console.log("Switching to night...");
  await page.click('button:text("Night")');
  await page.waitForTimeout(200);

  console.log("Placing night peasant...");
  await page.click('button:text("Peasant")');
  await page.waitForTimeout(200);
  await page.click("canvas", { position: { x: 450, y: 300 } });
  await page.waitForTimeout(200);

  // Place a church
  console.log("Placing night church...");
  await page.click('button:text("Church")');
  await page.waitForTimeout(200);
  await page.click("canvas", { position: { x: 480, y: 280 } });
  await page.waitForTimeout(200);

  // Select a piece to show path highlight
  console.log("Selecting piece for path highlight...");
  await page.click('button:text("Select")');
  await page.waitForTimeout(200);
  await page.click("canvas", { position: { x: 350, y: 300 } });
  await page.waitForTimeout(200);
  // Move mouse to a distant tile to trigger path highlight
  await page.mouse.move(500, 350);
  await page.waitForTimeout(500);

  await page.screenshot({ path: "screenshots/sandbox-demo.png", fullPage: false });
  console.log("Screenshot saved: screenshots/sandbox-demo.png");

  await browser.close();
};

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
