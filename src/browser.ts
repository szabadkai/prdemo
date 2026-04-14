import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { EventLogEntry } from "./types.js";

export interface RecordingResult {
  videoPath: string;
  eventLog: EventLogEntry[];
}

export async function recordDemo(
  baseUrl: string
): Promise<RecordingResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prdemo-video-"));
  const eventLog: EventLogEntry[] = [];
  const startTime = Date.now();

  function log(action: string, selector?: string, text?: string) {
    eventLog.push({
      timestamp: Date.now() - startTime,
      action,
      selector,
      text,
    });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // --- Hardcoded demo script (v0) ---
  log("navigate", undefined, baseUrl);
  await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");
  log("page_loaded", undefined, await page.title());

  // Pause to let the viewer take in the initial state
  await page.waitForTimeout(4000);

  // Click on list items if they exist (task completion demo)
  const listItems = await page.locator("li").all();
  if (listItems.length > 0) {
    // Click first item
    const firstText = await listItems[0].textContent();
    log("click", "li:nth-child(1)", firstText?.trim());
    await listItems[0].click();
    await page.waitForTimeout(3000);

    // Click second item
    if (listItems.length > 1) {
      const secondText = await listItems[1].textContent();
      log("click", "li:nth-child(2)", secondText?.trim());
      await listItems[1].click();
      await page.waitForTimeout(3000);
    }

    // Undo first item
    log("click", "li:nth-child(1)", "toggle back");
    await listItems[0].click();
    await page.waitForTimeout(3000);
  }

  // Navigate to another page if a link exists
  const links = await page.locator("a").all();
  if (links.length > 0) {
    const firstLink = links[0];
    const linkText = await firstLink.textContent();
    log("click", "a:first", linkText?.trim());
    await firstLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);
    log("navigated", undefined, await page.title());
  }

  // Scroll down to show more content
  await page.evaluate(() => window.scrollBy(0, 400));
  log("scroll", undefined, "down 400px");
  await page.waitForTimeout(3000);

  // Scroll back up
  await page.evaluate(() => window.scrollTo(0, 0));
  log("scroll", undefined, "top");
  await page.waitForTimeout(2000);

  // Navigate back
  await page.goBack();
  await page.waitForLoadState("networkidle");
  log("navigated_back", undefined, await page.title());
  await page.waitForTimeout(4000);

  log("demo_complete");

  // Close context to finalize video
  await context.close();
  await browser.close();

  // Find the recorded video file
  const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    throw new Error(`No video file found in ${tmpDir}`);
  }

  return {
    videoPath: path.join(tmpDir, files[0]),
    eventLog,
  };
}
