import { execFileSync, execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ffmpegModule from "ffmpeg-static";
const ffmpegBin: string = (ffmpegModule as unknown as string) || "ffmpeg";
import type { NarrationSegment } from "./types.js";

export interface RenderedAudio {
  paths: string[];
  durations: number[]; // duration in ms per segment
  tmpDir: string; // temp directory to clean up
}

export async function renderAudio(
  segments: NarrationSegment[]
): Promise<RenderedAudio> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prdemo-tts-"));
  const piperBin = process.env.PIPER_BIN || "piper";
  const voiceModel =
    process.env.PIPER_VOICE || "en_US-lessac-medium.onnx";

  // Check if piper is available
  const usePiper = isPiperAvailable(piperBin);

  const paths: string[] = [];
  const durations: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const outPath = path.join(tmpDir, `segment_${i}.wav`);

    if (usePiper) {
      renderWithPiper(piperBin, voiceModel, segment.text, outPath);
    } else {
      // Fallback: macOS `say` command
      renderWithSay(segment.text, outPath);
    }

    paths.push(outPath);
    durations.push(getAudioDurationMs(outPath));
  }

  return { paths, durations, tmpDir };
}

function isPiperAvailable(piperBin: string): boolean {
  try {
    execFileSync(piperBin, ["--help"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function renderWithPiper(
  piperBin: string,
  voiceModel: string,
  text: string,
  outPath: string
): void {
  // Piper reads text from stdin — use spawnSync to avoid shell injection
  const result = spawnSync(piperBin, ["--model", voiceModel, "--output_file", outPath], {
    input: text,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`Piper failed: ${result.stderr?.toString().slice(0, 200)}`);
  }
}

function renderWithSay(text: string, outPath: string): void {
  // macOS `say` voice — set SAY_VOICE in .env
  // Good options: Samantha (default), Daniel (British), Ava, Zoe, Tom, Karen, Alex
  // Fun ones: Whisper, Bad News, Good News, Cellos, Bells
  // List all: say -v '?'
  const voice = process.env.SAY_VOICE || "Samantha";
  const rate = process.env.SAY_RATE || "175"; // words per minute
  const aiffPath = outPath.replace(".wav", ".aiff");
  execSync(
    `say -v ${JSON.stringify(voice)} -r ${rate} -o ${aiffPath} ${JSON.stringify(text)}`,
    { stdio: "pipe" }
  );

  // Convert AIFF to WAV using ffmpeg-static
  try {
    execFileSync(ffmpegBin, [
      "-i", aiffPath,
      "-acodec", "pcm_s16le",
      "-ar", "22050",
      "-y", outPath,
    ], { stdio: "pipe" });
    fs.unlinkSync(aiffPath);
  } catch {
    // If ffmpeg conversion fails, just rename
    fs.renameSync(aiffPath, outPath);
  }
}

function getAudioDurationMs(filePath: string): number {
  // Read WAV header to get duration directly — no need for ffmpeg
  const buf = fs.readFileSync(filePath);
  // WAV format: bytes 28-31 = byte rate, bytes 40-43 = data chunk size
  if (buf.length < 44) return 2000; // fallback 2s
  const byteRate = buf.readUInt32LE(28);
  // Find "data" chunk
  let dataSize = 0;
  for (let i = 12; i < buf.length - 8; i++) {
    if (buf.toString("ascii", i, i + 4) === "data") {
      dataSize = buf.readUInt32LE(i + 4);
      break;
    }
  }
  if (byteRate === 0 || dataSize === 0) return 2000;
  return Math.round((dataSize / byteRate) * 1000);
}

/**
 * Re-space narration segments so they don't overlap, based on actual audio durations.
 * Each segment starts after the previous one finishes, with a gap between them.
 */
export function respaceSegments(
  segments: NarrationSegment[],
  durations: number[],
  gapMs = 800,
): NarrationSegment[] {
  const result: NarrationSegment[] = [];
  let cursor = segments[0]?.start ?? 0;

  for (let i = 0; i < segments.length; i++) {
    // Use the original start time if it's later than cursor (preserves natural pacing)
    const start = Math.max(cursor, segments[i].start);
    const end = start + durations[i];
    result.push({ ...segments[i], start, end });
    cursor = end + gapMs;
  }

  return result;
}


