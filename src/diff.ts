import { execSync } from "node:child_process";
import type { PRInfo } from "./types.js";

/**
 * Detect the default/base branch to diff against.
 * Priority: GITHUB_BASE_REF (CI) > main > master > HEAD~1
 */
function detectBaseBranch(projectDir: string): string | null {
  // In GitHub Actions, GITHUB_BASE_REF is the PR target branch
  const ciBase = process.env.GITHUB_BASE_REF;
  if (ciBase) {
    // In CI, we need origin/ prefix since local branch may not exist
    const ref = process.env.GITHUB_ACTIONS ? `origin/${ciBase}` : ciBase;
    try {
      execSync(`git rev-parse --verify ${ref}`, { cwd: projectDir, stdio: "ignore" });
      return ref;
    } catch {
      // fall through
    }
  }

  // Try main, then master
  for (const branch of ["main", "master"]) {
    try {
      execSync(`git rev-parse --verify ${branch}`, { cwd: projectDir, stdio: "ignore" });
      return branch;
    } catch {
      // try next
    }
  }

  return null;
}

export function getGitDiff(projectDir: string): string {
  const base = detectBaseBranch(projectDir);

  if (base) {
    try {
      return execSync(`git diff ${base}...HEAD`, {
        cwd: projectDir,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 5,
      });
    } catch {
      // fall through to HEAD~1
    }
  }

  try {
    return execSync("git diff HEAD~1", {
      cwd: projectDir,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 5,
    });
  } catch {
    return "(no diff available)";
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
