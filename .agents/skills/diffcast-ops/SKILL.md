---
name: diffcast-ops
description: How to build, run, test, and deploy the diffcast CLI and landing site. Use this skill when working on the diffcast project — running the CLI locally, building Docker images, publishing to npm, or deploying the landing page.
---

## Project overview

diffcast is a CLI that auto-generates narrated demo videos from pull requests. TypeScript ESM, Commander.js, Playwright, ffmpeg, Piper TTS, OpenRouter LLM.

Repo: github.com/szabadkai/prdemo  
npm: `diffcast`  
Docker: `ghcr.io/szabadkai/diffcast:latest`  
Landing page: GitHub Pages from `site/`

## Repository layout

```
package.json          # CLI package — "diffcast"
tsconfig.json         # ES2022, NodeNext, strict
src/                  # CLI source (TypeScript ESM)
  index.ts            # CLI entry (Commander.js)
  config.ts           # .diffcast.yml schema + loader (Zod)
  browser.ts          # Playwright recording
  narrator.ts         # LLM narration via OpenRouter
  infer.ts            # LLM demo script inference
  tts.ts              # Piper / macOS `say` TTS + voice auto-download
  mux.ts              # ffmpeg muxing
  github.ts           # Octokit: PR comments, release uploads
  diff.ts             # git diff extraction
  app-lifecycle.ts    # dev server start/stop
  types.ts            # shared types
dist/                 # tsc output (gitignored)
bench/                # benchmark harness
site/                 # Next.js landing page (separate package.json)
test-app/             # sample Next.js app used for test runs
Dockerfile            # Docker image with Piper + Playwright + ffmpeg
entrypoint.sh         # Docker entrypoint for GitHub Action
action.yml            # GitHub Action definition
.github/workflows/
  docker-publish.yml  # Build + push Docker image to GHCR on every push
  deploy-site.yml     # Deploy site/ to GitHub Pages on push to main
  prdemo.yml          # Self-test: run diffcast on its own PRs
```

## Environment variables

Create a `.env` file in the repo root (gitignored):

```
OPENROUTER_API_KEY=sk-or-...        # Required. LLM for narration + script inference
GITHUB_TOKEN=ghp_...                # Required for --post (PR comments, release uploads)
OPENROUTER_MODEL=google/gemini-2.0-flash-001  # Optional. Override default model
PIPER_BIN=/opt/piper/piper          # Optional. Path to piper binary (default: "piper" on PATH)
PIPER_VOICE=/path/to/model.onnx     # Optional. Explicit voice model path (auto-downloads if omitted)
SAY_VOICE=Samantha                   # Optional. macOS `say` voice (default: Samantha)
SAY_RATE=175                         # Optional. macOS `say` words per minute
```

The CLI loads `.env` automatically via dotenv.

## Build

```sh
npm install          # install deps
npm run build        # tsc → dist/
```

Output goes to `dist/`. The `prepublishOnly` script runs build automatically before `npm publish`.

## Run locally

```sh
# Development (tsx, no build needed)
npm run dev -- run --dry-run --verbose

# Production (requires build first)
npm run build
node dist/index.js run --dry-run --verbose

# Or if installed globally
npm i -g .
diffcast run --dry-run
```

### CLI commands

- `diffcast init` — Generate a starter `.diffcast.yml`
- `diffcast run` — Record and narrate a demo of the current PR
  - `--dry-run` — Preflight only, no recording
  - `--verbose` — Print diff preview, event log, narration segments
  - `--post` — Upload video to GitHub and comment on the PR
  - `--frame` / `--frame-in-browser` — Browser chrome frame
  - `-d <path>` — Project directory (default: `.`)
  - `-p <port>` — Dev server port
  - `-s <cmd>` — Start command
  - `-o <path>` — Output MP4 path

### Running against the test-app

```sh
cd test-app && npm install && cd ..
npm run dev -- run -d test-app --verbose
```

The test-app is a minimal Next.js app in `test-app/` with a home page and about page.

## TTS

Two engines:
1. **Piper** (preferred, cross-platform): auto-downloads `en_US-lessac-medium` model (~63MB) to `~/.cache/diffcast/voices/` on first use. Set `PIPER_BIN` if piper isn't on PATH.
2. **macOS `say`** (fallback): uses built-in speech synthesis. Set `SAY_VOICE` / `SAY_RATE` to customize.

## Docker

The Docker image bundles everything: Node 22, Playwright Chromium, Piper + voice model, ffmpeg.

```sh
# Build locally
docker build -t diffcast .

# Run locally
docker run --rm -v "$(pwd)":/github/workspace \
  -e OPENROUTER_API_KEY=sk-or-... \
  -e GITHUB_TOKEN=ghp_... \
  diffcast
```

The image is auto-published to `ghcr.io/szabadkai/diffcast:latest` by `.github/workflows/docker-publish.yml` on every push.

## Deploy

### npm

```sh
npm run build
npm publish --access public
```

Requires npm login with a granular access token that has 2FA bypass enabled. Version is in `package.json`.

### Docker image (GHCR)

Automatic via `.github/workflows/docker-publish.yml` on push to any branch. Tags: `latest` (main), `sha-<commit>`, semver from git tags.

### Landing page (GitHub Pages)

Automatic via `.github/workflows/deploy-site.yml` on push to `main` when `site/**` changes.

To work on the site locally:

```sh
cd site
npm install
npm run dev       # http://localhost:3000
npm run build     # static export → site/out/
```

The site uses Next.js 16 with Tailwind CSS v4 (CSS-based `@theme` config in `globals.css`, no `tailwind.config`). Static export with `output: "export"` in `next.config.ts`. `basePath` is set via `PAGES_BASE_PATH` env var for GitHub Pages.

### GitHub Action

Users add to their workflows:

```yaml
- uses: szabadkai/diffcast@main
  with:
    openrouter_api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

The action uses the Docker image. Inputs: `openrouter_api_key` (required), `github_token` (default: `github.token`), `openrouter_model`, `post` (default: `true`).

## Testing

No test suite yet. Current verification approach:

```sh
# 1. Build check
npm run build

# 2. CLI smoke test
node dist/index.js --help
node dist/index.js run --help

# 3. Dry run against test-app
node dist/index.js run -d test-app --dry-run --verbose

# 4. Full run against test-app (needs OPENROUTER_API_KEY)
node dist/index.js run -d test-app --verbose

# 5. Site build check
cd site && npm run build
```

## Common issues

- **"OPENROUTER_API_KEY is not set"**: Add it to `.env` or export it.
- **"No TTS engine found"**: Install Piper or run on macOS.
- **Push rejected**: Remote diverged. `git fetch origin main && git rebase origin/main`.
- **npm publish 403**: Token needs "bypass 2FA" permission on granular access tokens.
- **Site build fails**: Make sure you're in `site/` directory. It has its own `package.json`.
