#!/usr/bin/env npx tsx
/**
 * 20-PR Narrator Benchmark Runner
 *
 * Feeds each fixture through the narrator and evaluates quality:
 *  - Must-mention checks (does narration reference key concepts?)
 *  - Must-not-contain checks (no slop phrases?)
 *  - Minimum segment count
 *  - Segment duration sanity (no 0-length or overlapping)
 *  - Total word count in range
 *
 * Usage:
 *   npx tsx bench/run.ts              # run all 20
 *   npx tsx bench/run.ts --id dark-mode  # run one fixture
 *   npx tsx bench/run.ts --save       # save results to bench/results.json
 */

import { config } from "dotenv";
config();

import { generateNarration } from "../src/narrator.js";
import { fixtures, type BenchFixture } from "./fixtures.js";
import type { NarrationSegment } from "../src/types.js";
import fs from "node:fs";
import path from "node:path";

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

interface FixtureResult {
  id: string;
  description: string;
  segments: NarrationSegment[];
  checks: CheckResult[];
  pass: boolean;
  error?: string;
}

function evaluate(
  fixture: BenchFixture,
  segments: NarrationSegment[]
): CheckResult[] {
  const checks: CheckResult[] = [];
  const allText = segments.map((s) => s.text).join(" ").toLowerCase();
  const totalWords = allText.split(/\s+/).length;

  // 1. Must-mention
  for (const term of fixture.mustMention) {
    const found = allText.includes(term.toLowerCase());
    checks.push({
      name: `mentions "${term}"`,
      pass: found,
      detail: found ? "found" : "MISSING",
    });
  }

  // 2. Must-not-contain
  for (const term of fixture.mustNotContain) {
    const found = allText.includes(term.toLowerCase());
    checks.push({
      name: `avoids "${term}"`,
      pass: !found,
      detail: found ? "FOUND (slop)" : "clean",
    });
  }

  // 3. Minimum segments
  checks.push({
    name: `≥${fixture.minSegments} segments`,
    pass: segments.length >= fixture.minSegments,
    detail: `${segments.length} segments`,
  });

  // 4. Word count range (30-400 words)
  checks.push({
    name: "word count 30-400",
    pass: totalWords >= 30 && totalWords <= 400,
    detail: `${totalWords} words`,
  });

  // 5. No empty segments
  const hasEmpty = segments.some((s) => s.text.trim().length === 0);
  checks.push({
    name: "no empty segments",
    pass: !hasEmpty,
    detail: hasEmpty ? "has empty" : "ok",
  });

  // 6. Segments per-sentence under 40 words
  const longSegments = segments.filter(
    (s) => s.text.split(/\s+/).length > 40
  );
  checks.push({
    name: "segments ≤40 words each",
    pass: longSegments.length === 0,
    detail:
      longSegments.length === 0
        ? "ok"
        : `${longSegments.length} too long`,
  });

  // 7. Timestamps are monotonically non-decreasing
  let monotonic = true;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].start < segments[i - 1].start) {
      monotonic = false;
      break;
    }
  }
  checks.push({
    name: "timestamps monotonic",
    pass: monotonic,
    detail: monotonic ? "ok" : "out of order",
  });

  return checks;
}

async function runFixture(fixture: BenchFixture): Promise<FixtureResult> {
  try {
    const segments = await generateNarration(
      fixture.diff,
      fixture.eventLog,
      fixture.prInfo
    );
    const checks = evaluate(fixture, segments);
    return {
      id: fixture.id,
      description: fixture.description,
      segments,
      checks,
      pass: checks.every((c) => c.pass),
    };
  } catch (err) {
    return {
      id: fixture.id,
      description: fixture.description,
      segments: [],
      checks: [],
      pass: false,
      error: (err as Error).message,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const idFilter = args.includes("--id")
    ? args[args.indexOf("--id") + 1]
    : null;
  const saveResults = args.includes("--save");

  const selected = idFilter
    ? fixtures.filter((f) => f.id === idFilter)
    : fixtures;

  if (selected.length === 0) {
    console.error(`No fixture found with id "${idFilter}"`);
    process.exit(1);
  }

  console.log(
    `\n🧪 Narrator Benchmark — ${selected.length} fixture${selected.length > 1 ? "s" : ""}\n`
  );

  const results: FixtureResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const fixture of selected) {
    process.stdout.write(`  ${fixture.id} ... `);
    const result = await runFixture(fixture);
    results.push(result);

    if (result.error) {
      console.log(`❌ ERROR: ${result.error}`);
      failed++;
      continue;
    }

    if (result.pass) {
      console.log(`✅ ${result.checks.length} checks passed`);
      passed++;
    } else {
      const failures = result.checks.filter((c) => !c.pass);
      console.log(
        `❌ ${failures.length} failed: ${failures.map((f) => f.name).join(", ")}`
      );
      failed++;
    }
  }

  console.log(
    `\n  ────────────────────────────────────────`
  );
  console.log(
    `  ${passed}/${passed + failed} passed (${Math.round((passed / (passed + failed)) * 100)}%)\n`
  );

  if (saveResults) {
    const outPath = path.join(import.meta.dirname, "results.json");
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        results.map((r) => ({
          id: r.id,
          pass: r.pass,
          error: r.error,
          segments: r.segments,
          checks: r.checks,
        })),
        null,
        2
      )
    );
    console.log(`  Results saved to ${outPath}\n`);
  }

  // Detailed failures
  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0 && selected.length > 1) {
    console.log("  Failed fixtures:");
    for (const f of failures) {
      console.log(`\n  ── ${f.id} ──`);
      if (f.error) {
        console.log(`    Error: ${f.error}`);
      } else {
        for (const c of f.checks.filter((c) => !c.pass)) {
          console.log(`    ✗ ${c.name}: ${c.detail}`);
        }
        console.log(`    Narration:`);
        for (const s of f.segments) {
          console.log(`      [${s.start}ms] ${s.text}`);
        }
      }
    }
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
