import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import ffprobeModule from "ffprobe-static";
import type { EventLogEntry } from "./types.js";
import type { DemoStep, DiffcastConfig } from "./config.js";

const ffprobeBin: string = (ffprobeModule as { path?: string })?.path || "ffprobe";

export interface RecordingResult {
  videoPath: string;
  durationMs: number;
  eventLog: EventLogEntry[];
}

function probeDurationMs(videoPath: string): number | null {
  try {
    const out = execFileSync(
      ffprobeBin,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    ).toString().trim();
    const sec = parseFloat(out);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.round(sec * 1000);
  } catch {
    return null;
  }
}

export interface RecordOptions {
  baseUrl: string;
  config?: DiffcastConfig | null;
}

// Vite HMR, Sentry beacons, and analytics keep long-lived connections open —
// `networkidle` may never fire. Require DOM-ready, treat network-idle as best-effort.
async function settle(page: Page, idleTimeoutMs = 5000): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page
    .waitForLoadState("networkidle", { timeout: idleTimeoutMs })
    .catch(() => {});
}

async function installInBrowserFrame(
  context: BrowserContext,
  frame?: DiffcastConfig["frame"]
): Promise<void> {
  if (!frame?.enabled || !frame.inBrowser) return;

  const margin = Math.max(50, Math.round(frame.margin ?? 50));
  const inset = Math.max(25, Math.round(frame.contentInset ?? 25));
  const barHeight = Math.max(36, Math.round(frame.barHeight ?? 44));
  let bgDataUrl: string | null = null;
  if (frame.backgroundImage && fs.existsSync(frame.backgroundImage)) {
    const ext = path.extname(frame.backgroundImage).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const buf = fs.readFileSync(frame.backgroundImage);
    bgDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  }

  await context.addInitScript(
    ({ marginPx, insetPx, barHeightPx, backgroundImageUrl }) => {
      const apply = () => {
        if (document.getElementById("__diffcast_frame_style")) return;

        const style = document.createElement("style");
        style.id = "__diffcast_frame_style";
        style.textContent = `
          html {
            background: ${
              backgroundImageUrl
                ? `url('${backgroundImageUrl}') center/cover no-repeat`
                : "radial-gradient(1200px 700px at 15% 20%, #6d28d9 0%, #1f1140 45%, #0f172a 100%)"
            } !important;
            margin: 0 !important;
            min-height: 100% !important;
          }
          body {
            background: #ffffff !important;
            background-clip: content-box !important;
            margin: 0 !important;
            min-height: 100% !important;
          }
          body {
            box-sizing: border-box !important;
            padding: ${marginPx + barHeightPx}px ${marginPx}px ${marginPx}px !important;
            min-height: 100vh !important;
            overflow: hidden !important;
          }
          /* Force app content to occupy the full framed viewport area */
          body > :not(#__diffcast_frame_overlay):not(script):not(style) {
            width: calc(100vw - ${marginPx * 2}px) !important;
            max-width: none !important;
            min-height: calc(100vh - ${marginPx * 2 + barHeightPx}px) !important;
            margin: 0 !important;
          }
          #__next, #root, main, [data-nextjs-scroll-focus-boundary] {
            width: 100% !important;
            max-width: none !important;
            min-height: calc(100vh - ${marginPx * 2 + barHeightPx}px) !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          #__diffcast_frame_overlay {
            position: fixed;
            inset: ${marginPx}px;
            border: 2px solid #334155;
            background: transparent;
            border-radius: 10px;
            z-index: 2147483646;
            pointer-events: none;
            overflow: hidden;
          }
          #__diffcast_frame_overlay .bar {
            height: ${barHeightPx}px;
            border-bottom: 1px solid #334155;
            background: #0f172a;
            position: relative;
          }
          #__diffcast_frame_overlay .dot {
            width: 11px;
            height: 11px;
            border-radius: 50%;
            top: ${Math.round((barHeightPx - 11) / 2)}px;
            position: absolute;
          }
          #__diffcast_frame_overlay .dot.red { left: 14px; background: #ff5f57; }
          #__diffcast_frame_overlay .dot.yellow { left: 31px; background: #ffbd2e; }
          #__diffcast_frame_overlay .dot.green { left: 48px; background: #28c840; }
          #__diffcast_frame_overlay .address {
            position: absolute;
            left: 120px;
            right: 16px;
            top: ${Math.round((barHeightPx - 16) / 2)}px;
            height: 16px;
            border-radius: 8px;
            border: 1px solid #475569;
            background: #243244;
          }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement("div");
        overlay.id = "__diffcast_frame_overlay";
        overlay.innerHTML = `
          <div class="bar">
            <div class="dot red"></div>
            <div class="dot yellow"></div>
            <div class="dot green"></div>
            <div class="address"></div>
          </div>
        `;
        document.body.appendChild(overlay);
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
      } else {
        apply();
      }
    },
    {
      marginPx: margin,
      insetPx: inset,
      barHeightPx: barHeight,
      backgroundImageUrl: bgDataUrl,
    }
  );
}

export async function recordDemo(
  opts: RecordOptions
): Promise<RecordingResult> {
  const { baseUrl, config } = opts;
  const vw = config?.viewport?.width ?? 1280;
  const vh = config?.viewport?.height ?? 720;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diffcast-video-"));
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
    recordVideo: { dir: tmpDir, size: { width: vw, height: vh } },
    viewport: { width: vw, height: vh },
  });
  await installInBrowserFrame(context, config?.frame);

  const page = await context.newPage();

  // --- Auth flow (if configured) ---
  if (config?.auth) {
    log("auth_start");
    await page.goto(config.auth.url);
    await settle(page);
    await executeSteps(page, config.auth.steps, log);
    log("auth_complete");
  }

  // --- Demo script ---
  const steps = config?.demo?.script;
  const tolerant = !!config?.demo?.infer;
  if (steps && steps.length > 0) {
    // Config-driven demo
    log("navigate", undefined, baseUrl);
    await page.goto(baseUrl);
    await settle(page);
    log("page_loaded", undefined, await page.title());
    await executeSteps(page, steps, log, tolerant);
  } else {
    // Fallback: auto-explore (v0 behavior)
    await autoExplore(page, baseUrl, log);
  }

  log("demo_complete");

  // Close context to finalize video
  await context.close();
  await browser.close();

  // Find the recorded video file
  const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    throw new Error(`No video file found in ${tmpDir}`);
  }

  const videoPath = path.join(tmpDir, files[0]);
  const probed = probeDurationMs(videoPath);
  const fallbackMs = (eventLog[eventLog.length - 1]?.timestamp ?? 0) + 1000;
  const durationMs = probed ?? fallbackMs;

  return {
    videoPath,
    durationMs,
    eventLog,
  };
}

// ---------- Step executor ----------

type LogFn = (action: string, selector?: string, text?: string) => void;

async function executeSteps(
  page: Page,
  steps: DemoStep[],
  log: LogFn,
  tolerant = false
): Promise<void> {
  // In tolerant mode (inferred scripts), use a shorter timeout so bad selectors
  // don't stall the whole recording, and skip steps that fail.
  const actionTimeout = tolerant ? 5000 : 30000;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      switch (step.action) {
        case "navigate": {
          const target = step.value || "/";
          const url = target.startsWith("http")
            ? target
            : new URL(target, page.url()).href;
          log("navigate", undefined, url);
          await page.goto(url, { timeout: actionTimeout });
          await page.waitForLoadState("networkidle").catch(() => {});
          break;
        }
        case "click": {
          if (!step.selector) break;
          const el = page.locator(step.selector).first();
          const text = await el.textContent({ timeout: actionTimeout }).catch(() => null);
          log("click", step.selector, text?.trim());
          await el.click({ timeout: actionTimeout });
          break;
        }
        case "type": {
          if (!step.selector || !step.value) break;
          log("type", step.selector, step.value);
          await page.locator(step.selector).first().fill(step.value, { timeout: actionTimeout });
          break;
        }
        case "scroll": {
          const dir = step.scroll || step.value || "down 400";
          if (dir === "top") {
            await page.evaluate(() => window.scrollTo(0, 0));
          } else {
            const match = dir.match(/down\s+(\d+)/);
            const px = match ? parseInt(match[1], 10) : 400;
            await page.evaluate((y) => window.scrollBy(0, y), px);
          }
          log("scroll", undefined, dir);
          break;
        }
        case "wait": {
          break;
        }
        case "screenshot": {
          log("screenshot", undefined, step.value);
          break;
        }
        case "go_back": {
          await page.goBack({ timeout: actionTimeout });
          await page.waitForLoadState("networkidle").catch(() => {});
          log("go_back", undefined, await page.title());
          break;
        }
      }
    } catch (err) {
      if (tolerant) {
        log("step_skipped", step.selector, `Step ${i + 1} failed: ${(err as Error).message?.split("\n")[0]}`);
        continue;
      }
      throw err;
    }

    if (step.narrate) {
      log("narrate", step.selector, step.narrate);
    }

    const delay = step.delay ?? 3000;
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
  }
}

// ---------- Auto-explore fallback (v0 behavior) ----------

async function autoExplore(
  page: Page,
  baseUrl: string,
  log: LogFn
): Promise<void> {
  log("navigate", undefined, baseUrl);
  await page.goto(baseUrl);
  await settle(page);
  log("page_loaded", undefined, await page.title());

  await page.waitForTimeout(6000);

  // Click on list items if they exist
  const listItems = await page.locator("li").all();
  if (listItems.length > 0) {
    const firstText = await listItems[0].textContent();
    log("click", "li:nth-child(1)", firstText?.trim());
    await listItems[0].click();
    await page.waitForTimeout(5000);

    if (listItems.length > 1) {
      const secondText = await listItems[1].textContent();
      log("click", "li:nth-child(2)", secondText?.trim());
      await listItems[1].click();
      await page.waitForTimeout(5000);
    }

    log("click", "li:nth-child(1)", "toggle back");
    await listItems[0].click();
    await page.waitForTimeout(5000);
  }

  // Navigate via link if available
  const links = await page.locator("a").all();
  if (links.length > 0) {
    const firstLink = links[0];
    const linkText = await firstLink.textContent();
    log("click", "a:first", linkText?.trim());
    await firstLink.click();
    await settle(page);
    await page.waitForTimeout(6000);
    log("navigated", undefined, await page.title());
  }

  await page.evaluate(() => window.scrollBy(0, 400));
  log("scroll", undefined, "down 400px");
  await page.waitForTimeout(4000);

  await page.evaluate(() => window.scrollTo(0, 0));
  log("scroll", undefined, "top");
  await page.waitForTimeout(3000);

  await page.goBack();
  await settle(page);
  log("navigated_back", undefined, await page.title());
  await page.waitForTimeout(6000);
}
