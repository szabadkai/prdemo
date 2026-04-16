import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { NarrationSegment } from "./types.js";

import ffmpegModule from "ffmpeg-static";
const ffmpegBin: string = (ffmpegModule as unknown as string) || "ffmpeg";

export function muxVideo(
  videoPath: string,
  audioPaths: string[],
  segments: NarrationSegment[],
  outputPath: string
): string {
  if (audioPaths.length === 0) {
    // No audio — just convert video to MP4
    execFileSync(ffmpegBin, [
      "-i", videoPath,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-y", outputPath,
    ], { stdio: "pipe" });
    return outputPath;
  }

  // Calculate the total duration needed for all narration
  const lastSegment = segments[segments.length - 1];
  const requiredDurationMs = lastSegment.end + 1500; // 1.5s padding after last segment
  const requiredDurationSec = requiredDurationMs / 1000;

  // Build ffmpeg filter to place each audio segment at its timestamp.
  // Use tpad to extend the video if narration runs longer.
  const inputs: string[] = ["-i", videoPath];
  const filterParts: string[] = [];

  // Extend video by holding last frame if needed
  filterParts.push(`[0:v]tpad=stop_mode=clone:stop_duration=${requiredDurationSec}[vpad]`);

  for (let i = 0; i < audioPaths.length; i++) {
    inputs.push("-i", audioPaths[i]);
    const delayMs = segments[i].start;
    // adelay delays audio by N ms on all channels
    filterParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs}[a${i}]`);
  }

  // Mix all delayed audio tracks together
  const mixInputs = audioPaths.map((_, i) => `[a${i}]`).join("");
  filterParts.push(
    `${mixInputs}amix=inputs=${audioPaths.length}:duration=longest[aout]`
  );

  const filterComplex = filterParts.join(";");

  const args = [
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", "[vpad]",
    "-map", "[aout]",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-y", outputPath,
  ];

  console.log(`  Running ffmpeg...`);
  execFileSync(ffmpegBin, args, { stdio: "pipe" });

  return outputPath;
}

/**
 * Generate an animated GIF preview from an MP4.
 * Downscales to 480px wide, 10fps, capped at ~15s for size.
 * Uses a two-pass palette approach for better quality.
 */
export function generateGif(
  videoPath: string,
  outputPath: string,
  opts: { maxWidth?: number; fps?: number; maxDurationSec?: number } = {}
): string {
  const maxWidth = opts.maxWidth ?? 480;
  const fps = opts.fps ?? 10;
  const maxDur = opts.maxDurationSec ?? 15;

  const palettePath = outputPath.replace(/\.gif$/, "-palette.png");

  const filters = `fps=${fps},scale=${maxWidth}:-1:flags=lanczos`;

  // Pass 1: generate palette
  execFileSync(ffmpegBin, [
    "-t", String(maxDur),
    "-i", videoPath,
    "-vf", `${filters},palettegen=stats_mode=diff`,
    "-y", palettePath,
  ], { stdio: "pipe" });

  // Pass 2: generate GIF using palette
  execFileSync(ffmpegBin, [
    "-t", String(maxDur),
    "-i", videoPath,
    "-i", palettePath,
    "-lavfi", `${filters} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    "-y", outputPath,
  ], { stdio: "pipe" });

  // Clean up palette
  try {
    fs.unlinkSync(palettePath);
  } catch { /* ignore */ }

  return outputPath;
}
