#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import dotenv from "dotenv";
import { startApp, waitForReady, stopApp } from "./app-lifecycle.js";
import { recordDemo } from "./browser.js";
import { getGitDiff, getPRInfo } from "./diff.js";
import { generateNarration } from "./narrator.js";
import { renderAudio, respaceSegments } from "./tts.js";
import { muxVideo } from "./mux.js";

dotenv.config();

const program = new Command();

program
  .name("prdemo")
  .description("Produce narrated demo videos from pull requests")
  .version("0.0.1");

program
  .command("run")
  .description("Record and narrate a demo of the current PR")
  .requiredOption(
    "-d, --project-dir <path>",
    "Path to the project directory"
  )
  .option("-p, --port <number>", "Dev server port", "3000")
  .option(
    "-s, --start-cmd <cmd>",
    "Command to start the dev server",
    "npm run dev"
  )
  .option(
    "-o, --output <path>",
    "Output MP4 path",
    "prdemo-output.mp4"
  )
  .action(async (opts) => {
    const projectDir = path.resolve(opts.projectDir);
    const port = parseInt(opts.port, 10);
    const startCmd = opts.startCmd;
    const readyUrl = `http://localhost:${port}`;
    const outputPath = path.resolve(opts.output);

    console.log(`\n🎬 prdemo v0 — spike\n`);
    console.log(`  Project:  ${projectDir}`);
    console.log(`  Port:     ${port}`);
    console.log(`  Start:    ${startCmd}`);
    console.log(`  Output:   ${outputPath}\n`);

    let appHandle;

    try {
      // Step 1: Start the app
      console.log("1/6 Starting app...");
      appHandle = startApp(projectDir, startCmd, port);
      await waitForReady(readyUrl);
      console.log("  App is ready.\n");

      // Step 2: Record browser demo
      console.log("2/6 Recording browser demo...");
      const { videoPath, eventLog } = await recordDemo(readyUrl);
      console.log(`  Video: ${videoPath}`);
      console.log(`  Events: ${eventLog.length} entries\n`);

      // Step 3: Extract diff + PR info
      console.log("3/6 Extracting git diff...");
      const diff = getGitDiff(projectDir);
      const prInfo = getPRInfo(projectDir);
      console.log(`  Branch: ${prInfo.branch}`);
      console.log(
        `  Diff: ${diff.split("\n").length} lines\n`
      );

      // Step 4: Generate narration
      console.log("4/6 Generating narration...");
      const segments = await generateNarration(diff, eventLog, prInfo);
      console.log(`  Generated ${segments.length} segments\n`);

      // Step 5: Render TTS
      console.log("5/6 Rendering audio...");
      const rendered = await renderAudio(segments);
      console.log(`  Rendered ${rendered.paths.length} audio files`);
      console.log(`  Durations: ${rendered.durations.map(d => (d / 1000).toFixed(1) + "s").join(", ")}`);

      // Re-space segments so narration doesn't overlap
      const paced = respaceSegments(segments, rendered.durations);
      console.log(`  Paced timeline: ${paced.map(s => (s.start / 1000).toFixed(1) + "–" + (s.end / 1000).toFixed(1) + "s").join(", ")}\n`);

      // Step 6: Mux video + audio
      console.log("6/6 Assembling final video...");
      muxVideo(videoPath, rendered.paths, paced, outputPath);
      console.log(`\n✅ Done! Output: ${outputPath}\n`);
    } catch (err) {
      console.error(
        "\n❌ Error:",
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    } finally {
      if (appHandle) {
        stopApp(appHandle);
      }
    }
  });

program.parse();
