#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { startApp, waitForReady, stopApp } from "./app-lifecycle.js";
import { execSync } from "node:child_process";
import { recordDemo } from "./browser.js";
import { getGitDiff, getPRInfo } from "./diff.js";
import { generateNarration } from "./narrator.js";
import { renderAudio, respaceSegments } from "./tts.js";
import { muxVideo, generateGif } from "./mux.js";
import { postToGitHub } from "./github.js";
import { inferDemoScript } from "./infer.js";
import {
  loadConfig,
  resolveReadyUrl,
  generateConfig,
  detectFramework,
  type DiffcastConfig,
} from "./config.js";

dotenv.config();

// ---------- Preflight checks ----------

function checkEnv(): string[] {
  const warnings: string[] = [];
  if (!process.env.OPENROUTER_API_KEY) {
    warnings.push(
      "OPENROUTER_API_KEY is not set. Narration will fail.\n" +
      "  Get one at https://openrouter.ai → copy into .env"
    );
  }
  return warnings;
}

function checkTools(): string[] {
  const warnings: string[] = [];

  // Check for Piper or macOS say
  const piperBin = process.env.PIPER_BIN || "piper";
  const hasPiper = (() => {
    try { execSync(`which "${piperBin}" 2>/dev/null || test -x "${piperBin}"`, { stdio: "ignore" }); return true; } catch { return false; }
  })();
  const piperVoice = process.env.PIPER_VOICE;
  const hasSay = process.platform === "darwin";

  if (!hasPiper && !hasSay) {
    warnings.push(
      "No TTS engine found. Install Piper (https://github.com/rhasspy/piper)\n" +
      "  or run on macOS (uses built-in `say` command)."
    );
  } else if (hasPiper && piperVoice && !fs.existsSync(piperVoice)) {
    warnings.push(
      `PIPER_VOICE points to ${piperVoice} but the file doesn't exist.\n` +
      "  Download a voice model from https://github.com/rhasspy/piper/blob/master/VOICES.md"
    );
  }

  // Check git is available
  try { execSync("git --version", { stdio: "ignore" }); } catch {
    warnings.push("git is not installed or not on PATH. Diff extraction will fail.");
  }

  return warnings;
}

const program = new Command();

program
  .name("diffcast")
  .description("Produce narrated demo videos from pull requests")
  .version("0.1.0");

// ---------- init ----------

program
  .command("init")
  .description("Generate a starter .diffcast.yml for this project")
  .option("-d, --project-dir <path>", "Path to the project directory", ".")
  .option("-p, --port <number>", "Dev server port")
  .action((opts) => {
    const projectDir = path.resolve(opts.projectDir);
    const outFile = path.join(projectDir, ".diffcast.yml");

    if (fs.existsSync(outFile)) {
      console.log(`⚠ ${outFile} already exists. Delete it first to re-init.`);
      process.exit(1);
    }

    const framework = detectFramework(projectDir);
    console.log(`  Detected framework: ${framework}`);

    const port = opts.port ? parseInt(opts.port, 10) : undefined;
    const yml = generateConfig({ framework, port });

    fs.writeFileSync(outFile, yml, "utf-8");
    console.log(`✅ Created ${outFile}\n`);
    console.log(`  Edit the demo.script section to describe your PR's demo flow.`);
    console.log(`  Then run: diffcast run\n`);
  });

// ---------- run ----------

program
  .command("run")
  .description("Record and narrate a demo of the current PR")
  .option("-d, --project-dir <path>", "Path to the project directory", ".")
  .option("-p, --port <number>", "Dev server port (overrides config)")
  .option("-s, --start-cmd <cmd>", "Start command (overrides config)")
  .option("-o, --output <path>", "Output MP4 path (overrides config)")
  .option("--frame", "Wrap output with browser-style frame")
  .option("--frame-in-browser", "Render frame in browser while recording (faster)")
  .option("--post", "Post the video as a GitHub PR comment")
  .option("--dry-run", "Show what would happen without recording or posting")
  .option("--verbose", "Show detailed output for each step")
  .action(async (opts) => {
    const projectDir = path.resolve(opts.projectDir);
    const dryRun = !!opts.dryRun;
    const verbose = !!opts.verbose;

    // Load config (optional — falls back to defaults + CLI flags)
    const config = loadConfig(projectDir);
    if (config) {
      console.log("  Loaded .diffcast.yml");
      // Load extra env files from config
      if (config.env) {
        for (const envFile of config.env) {
          const envPath = path.resolve(projectDir, envFile);
          if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
          }
        }
      }
    }

    // Resolve settings: CLI flags > config > defaults
    const startCmd = opts.startCmd || config?.start || "npm run dev";
    const readyRaw = opts.port
      ? `http://localhost:${opts.port}`
      : config?.ready || "http://localhost:3000";
    const { url: readyUrl, port } = resolveReadyUrl(readyRaw);
    const outputPath = path.resolve(
      opts.output || config?.output || "diffcast-output.mp4"
    );

    // Apply model override from config
    if (config?.model && !process.env.OPENROUTER_MODEL) {
      if (typeof config.model === "string") {
        process.env.OPENROUTER_MODEL = config.model;
      } else {
        // Per-task model overrides — set individual env vars
        if (config.model.infer) {
          process.env.OPENROUTER_MODEL_INFER = config.model.infer;
        }
        if (config.model.narrate) {
          process.env.OPENROUTER_MODEL_NARRATE = config.model.narrate;
        }
      }
    }

    console.log(`\n🎬 diffcast v0.1\n`);
    console.log(`  Project:  ${projectDir}`);
    console.log(`  Port:     ${port}`);
    console.log(`  Start:    ${startCmd}`);
    console.log(`  Output:   ${outputPath}`);
    if (config) {
      const stepCount = config.demo?.script?.length ?? 0;
      const scriptLabel = stepCount > 0 ? `${stepCount} steps` : config.demo?.infer ? "infer (from diff)" : "auto-explore";
      console.log(`  Script:   ${scriptLabel}`);
    }
    if (dryRun) console.log(`  Mode:     dry-run`);
    console.log();

    // Preflight checks
    const envWarnings = checkEnv();
    const toolWarnings = checkTools();
    const allWarnings = [...envWarnings, ...toolWarnings];
    if (allWarnings.length > 0) {
      for (const w of allWarnings) {
        console.log(`  ⚠ ${w}`);
      }
      console.log();
    }

    if (dryRun) {
      console.log("Dry run complete — no recording or posting performed.\n");
      return;
    }

    let appHandle;
    const tmpDirs: string[] = [];

    try {
      // Step 1: Setup (if configured)
      if (config?.setup) {
        console.log("0/6 Running setup...");
        const { execSync } = await import("node:child_process");
        execSync(config.setup, { cwd: projectDir, stdio: "inherit" });
        console.log("  Setup complete.\n");
      }

      // Step 1: Start the app
      console.log("1/6 Starting app...");
      appHandle = startApp(projectDir, startCmd, port);
      await waitForReady(readyUrl, config?.limits?.readyTimeoutMs);
      console.log("  App is ready.\n");

      // Step 2a: Extract diff + PR info (needed before recording if infer mode)
      console.log("2/6 Extracting git diff...");
      const diff = getGitDiff(projectDir);
      const prInfo = getPRInfo(projectDir);
      console.log(`  Branch: ${prInfo.branch}`);
      console.log(`  Diff: ${diff.split("\n").length} lines\n`);
      if (verbose) {
        console.log("  --- Diff preview (first 40 lines) ---");
        console.log(diff.split("\n").slice(0, 40).map(l => `  ${l}`).join("\n"));
        console.log("  ---\n");
      }

      // Step 2b: Infer demo script if configured
      let effectiveConfig = config;
      if (config?.demo?.infer && (!config.demo.script || config.demo.script.length === 0)) {
        console.log("2b/6 Inferring demo script from diff...");
        const inferredSteps = await inferDemoScript(diff, prInfo, readyUrl, {
          diffCharLimit: config.limits?.inferDiffChars,
        });
        console.log(`  Inferred ${inferredSteps.length} steps\n`);
        // Merge inferred steps into a copy of the config
        effectiveConfig = {
          ...config,
          demo: { ...config.demo, script: inferredSteps },
        };
      }

      // Render frame in-browser during recording (fast path).
      if (opts.frame || opts.frameInBrowser || effectiveConfig?.frame?.enabled) {
        effectiveConfig = {
          ...(effectiveConfig || {}),
          frame: {
            ...(effectiveConfig?.frame || {}),
            enabled: true,
            inBrowser: true,
            backgroundImage: effectiveConfig?.frame?.backgroundImage
              ? path.resolve(projectDir, effectiveConfig.frame.backgroundImage)
              : undefined,
          },
        } as DiffcastConfig;
      }

      // Step 3: Record browser demo
      console.log("3/6 Recording browser demo...");
      const { videoPath, eventLog } = await recordDemo({
        baseUrl: readyUrl,
        config: effectiveConfig,
      });
      tmpDirs.push(path.dirname(videoPath));
      console.log(`  Video: ${videoPath}`);
      console.log(`  Events: ${eventLog.length} entries\n`);
      if (verbose && eventLog.length > 0) {
        for (const e of eventLog) {
          console.log(`    ${(e.timestamp / 1000).toFixed(1)}s  ${e.action}${e.selector ? ` → ${e.selector}` : ""}${e.text ? ` "${e.text}"` : ""}`);
        }
        console.log();
      }

      // Step 4: Generate narration
      console.log("4/6 Generating narration...");
      const segments = await generateNarration(diff, eventLog, prInfo, {
        diffCharLimit: config?.limits?.narrateDiffChars,
      });
      console.log(`  Generated ${segments.length} segments\n`);
      if (verbose) {
        for (const s of segments) {
          console.log(`    ${(s.start / 1000).toFixed(1)}–${(s.end / 1000).toFixed(1)}s: "${s.text}"`);
        }
        console.log();
      }

      // Step 5: Render TTS
      console.log("5/6 Rendering audio...");
      const rendered = await renderAudio(segments);
      tmpDirs.push(rendered.tmpDir);
      console.log(`  Rendered ${rendered.paths.length} audio files`);
      console.log(
        `  Durations: ${rendered.durations.map((d) => (d / 1000).toFixed(1) + "s").join(", ")}`
      );

      // Re-space segments so narration doesn't overlap
      const paced = respaceSegments(segments, rendered.durations);
      console.log(
        `  Paced timeline: ${paced.map((s) => (s.start / 1000).toFixed(1) + "–" + (s.end / 1000).toFixed(1) + "s").join(", ")}\n`
      );

      // Step 6: Mux video + audio
      console.log("6/6 Assembling final video...");
      muxVideo(videoPath, rendered.paths, paced, outputPath);
      console.log(`\n✅ Done! Output: ${outputPath}\n`);

      // Step 7: Post to GitHub (optional)
      if (opts.post) {
        const ghToken = process.env.GITHUB_TOKEN;
        if (!ghToken) {
          console.log(
            "⚠ --post requires GITHUB_TOKEN in your environment. Skipping.\n"
          );
        } else {
          console.log("7/7 Posting to GitHub...");

          // Generate GIF preview
          const gifPath = outputPath.replace(/\.mp4$/, ".gif");
          console.log("  Generating GIF preview...");
          try {
            generateGif(outputPath, gifPath);
            const gifSize = fs.statSync(gifPath).size;
            console.log(`  GIF: ${gifPath} (${Math.round(gifSize / 1024)}KB)`);
          } catch (err) {
            console.log("  ⚠ GIF generation failed, posting without preview.");
          }

          const lastPaced = paced[paced.length - 1];
          const durationSec = lastPaced
            ? (lastPaced.end + 1500) / 1000
            : 0;
          try {
            const result = await postToGitHub({
              token: ghToken,
              projectDir,
              videoPath: outputPath,
              gifPath: fs.existsSync(gifPath) ? gifPath : undefined,
              branch: prInfo.branch,
              commitMessage: prInfo.commitMessage,
              segmentCount: paced.length,
              durationSec,
            });
            console.log(`  Comment: ${result.commentUrl}`);
            if (result.releaseUrl) {
              console.log(`  Release: ${result.releaseUrl}`);
            }
            console.log();
          } catch (err) {
            console.error(
              "  ⚠ GitHub posting failed:",
              err instanceof Error ? err.message : err
            );
            console.log("  Video was still saved locally.\n");
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error: ${msg}`);

      // Actionable hints for common failures
      if (msg.includes("OPENROUTER_API_KEY")) {
        console.error("\n  → Create a .env file with your API key:");
        console.error("    cp .env.example .env && $EDITOR .env");
      } else if (msg.includes("did not become ready")) {
        console.error("\n  → Is the start command correct? Check .diffcast.yml → start:");
        console.error(`    Currently: "${startCmd}"`);
        console.error(`    Expected to listen on: ${readyUrl}`);
      } else if (msg.includes("No video file found")) {
        console.error("\n  → Playwright recording failed. Try: npx playwright install chromium");
      } else if (msg.includes("Invalid config")) {
        console.error("\n  → Fix the issues above in .diffcast.yml");
        console.error("    Run `diffcast init` to generate a fresh config.");
      }

      process.exit(1);
    } finally {
      if (appHandle) {
        stopApp(appHandle);
      }
      // Clean up temp directories
      for (const dir of tmpDirs) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    }
  });

program.parse();
