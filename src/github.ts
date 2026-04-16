import { Octokit } from "@octokit/rest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface RepoInfo {
  owner: string;
  repo: string;
}

export interface GitHubPostResult {
  commentUrl: string;
  releaseUrl?: string;
}

/**
 * Extract owner/repo from the git remote URL.
 */
export function getRepoInfo(projectDir: string): RepoInfo | null {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: projectDir,
      encoding: "utf-8",
    }).trim();

    // SSH: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(
      /github\.com\/([^/]+)\/([^/.]+)/
    );
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
  } catch {
    // no remote
  }
  return null;
}

/**
 * Find the open PR number for the current branch.
 */
export async function findPRForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<number | null> {
  try {
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: "open",
      per_page: 1,
    });
    return prs.length > 0 ? prs[0].number : null;
  } catch {
    return null;
  }
}

/**
 * Upload video as a GitHub release asset and post a PR comment.
 *
 * Strategy:
 * 1. Create (or reuse) a prerelease tagged `diffcast-<branch>`
 * 2. Upload the MP4 as a release asset (downloadable link)
 * 3. Post a comment on the PR with a download link and preview image
 *
 * Note: GitHub only renders inline video players for files uploaded
 * through their web UI drag-and-drop. Release assets appear as links.
 */
export async function postToGitHub(opts: {
  token: string;
  projectDir: string;
  videoPath: string;
  gifPath?: string;
  branch: string;
  commitMessage: string;
  segmentCount: number;
  durationSec: number;
}): Promise<GitHubPostResult> {
  const octokit = new Octokit({ auth: opts.token });

  // 1. Resolve repo
  const repoInfo = getRepoInfo(opts.projectDir);
  if (!repoInfo) {
    throw new Error(
      "Could not detect GitHub repo from git remote. Is this a GitHub repository?"
    );
  }
  const { owner, repo } = repoInfo;

  // 2. Find open PR
  const prNumber = await findPRForBranch(
    octokit,
    owner,
    repo,
    opts.branch
  );
  if (!prNumber) {
    throw new Error(
      `No open PR found for branch "${opts.branch}" in ${owner}/${repo}. Push your branch and open a PR first.`
    );
  }

  // 3. Check video file size (GitHub release assets are limited to ~2GB,
  //    but practical limit for PR demos is ~100MB)
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
  const videoSize = fs.statSync(opts.videoPath).size;
  if (videoSize > MAX_VIDEO_SIZE) {
    throw new Error(
      `Video file is ${Math.round(videoSize / 1024 / 1024)}MB, which exceeds the 100MB limit for GitHub release assets. ` +
      `Try reducing the recording duration or resolution.`
    );
  }

  // 4. Upload video as release asset
  const tag = `diffcast-${opts.branch}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
  const releaseUrl = await uploadReleaseAsset(
    octokit,
    owner,
    repo,
    tag,
    opts.videoPath
  );

  // 3b. Upload GIF preview as release asset (if provided)
  if (opts.gifPath && fs.existsSync(opts.gifPath)) {
    await uploadReleaseAsset(
      octokit,
      owner,
      repo,
      tag,
      opts.gifPath
    );
  }

  // 4. Post PR comment
  const fileName = path.basename(opts.videoPath);
  const fileSize = fs.statSync(opts.videoPath).size;
  const sizeKB = Math.round(fileSize / 1024);
  const downloadUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${fileName}`;

  const COMMENT_MARKER = "<!-- diffcast-pr-demo -->";

  const bodyParts = [
    COMMENT_MARKER,
    `## 🎬 PR Demo`,
    ``,
    `**Branch:** \`${opts.branch}\``,
    `**Commit:** ${opts.commitMessage.split("\n")[0]}`,
    ``,
  ];

  // Embed GIF preview inline if available
  if (opts.gifPath && fs.existsSync(opts.gifPath)) {
    const gifName = path.basename(opts.gifPath);
    const gifUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${gifName}`;
    const gifSize = fs.statSync(opts.gifPath).size;
    const gifSizeKB = Math.round(gifSize / 1024);
    bodyParts.push(
      `[![Demo preview](${gifUrl})](${downloadUrl})`,
      ``,
      `*GIF preview (${gifSizeKB}KB) — [▶️ Download full video with audio (${Math.round(opts.durationSec)}s, ${sizeKB}KB)](${downloadUrl})*`,
    );
  } else {
    bodyParts.push(
      `### [▶️ Watch Demo Video (${Math.round(opts.durationSec)}s, ${sizeKB}KB)](${downloadUrl})`,
    );
  }

  bodyParts.push(
    ``,
    `<details><summary>Details</summary>`,
    ``,
    `- Duration: ~${Math.round(opts.durationSec)}s`,
    `- Narration segments: ${opts.segmentCount}`,
    `- File size: ${sizeKB}KB`,
    `- Generated by [diffcast](https://github.com/szabadkai/diffcast)`,
    ``,
    `</details>`,
  );

  const body = bodyParts.join("\n");

  // Upsert: find existing diffcast comment and update it, or create a new one
  let commentUrl: string;
  const existingComment = await findExistingComment(octokit, owner, repo, prNumber, COMMENT_MARKER);
  if (existingComment) {
    const { data: updated } = await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment,
      body,
    });
    commentUrl = updated.html_url;
  } else {
    const { data: created } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    commentUrl = created.html_url;
  }

  return {
    commentUrl,
    releaseUrl,
  };
}

/**
 * Find an existing diffcast comment on a PR by its hidden marker.
 */
async function findExistingComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  marker: string
): Promise<number | null> {
  try {
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });
    const match = comments.find((c) => c.body?.includes(marker));
    return match ? match.id : null;
  } catch {
    return null;
  }
}

/**
 * Create or reuse a release and upload the video as an asset.
 */
async function uploadReleaseAsset(
  octokit: Octokit,
  owner: string,
  repo: string,
  tag: string,
  videoPath: string
): Promise<string> {
  const fileName = path.basename(videoPath);

  let releaseId: number | undefined;

  try {
    const { data: existing } = await octokit.repos.getReleaseByTag({
      owner,
      repo,
      tag,
    });
    releaseId = existing.id;

    // Delete old asset with same name if it exists
    const { data: assets } = await octokit.repos.listReleaseAssets({
      owner,
      repo,
      release_id: releaseId,
      per_page: 50,
    });
    const oldAsset = assets.find((a) => a.name === fileName);
    if (oldAsset) {
      await octokit.repos.deleteReleaseAsset({
        owner,
        repo,
        asset_id: oldAsset.id,
      });
    }
  } catch {
    // Release doesn't exist — create it
    try {
      const sha = execSync("git rev-parse HEAD", {
        encoding: "utf-8",
      }).trim();

      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/tags/${tag}`,
        sha,
      });
    } catch {
      // Tag may already exist
    }

    const { data: created } = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: `diffcast: ${tag.replace("diffcast-", "")}`,
      body: "Auto-generated by diffcast. Contains demo video assets.",
      draft: false,
      prerelease: true,
    });
    releaseId = created.id;
  }

  // Upload the video
  const fileData = fs.readFileSync(videoPath);

  await octokit.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: releaseId!,
    name: fileName,
    // @ts-expect-error — Octokit types expect string but Buffer works
    data: fileData,
    headers: {
      "content-type": "video/mp4",
      "content-length": fileData.length,
    },
  });

  return `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
}
