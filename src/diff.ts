import { execSync } from "node:child_process";
import type { PRInfo } from "./types.js";

export function getGitDiff(projectDir: string): string {
  try {
    // Try three-dot diff against main first
    return execSync("git diff main...HEAD", {
      cwd: projectDir,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 5,
    });
  } catch {
    try {
      // Fall back to diffing against HEAD~1
      return execSync("git diff HEAD~1", {
        cwd: projectDir,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 5,
      });
    } catch {
      return "(no diff available)";
    }
  }
}

export function getPRInfo(projectDir: string): PRInfo {
  let branch = "unknown";
  let commitMessage = "";

  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectDir,
      encoding: "utf-8",
    }).trim();
  } catch {
    // ignore
  }

  try {
    commitMessage = execSync("git log -1 --pretty=%B", {
      cwd: projectDir,
      encoding: "utf-8",
    }).trim();
  } catch {
    // ignore
  }

  return { branch, commitMessage };
}
