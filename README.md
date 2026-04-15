# prdemo

CLI that produces narrated demo videos from pull requests. Point it at any JS/TS web app, and it records a browser demo, generates narration from the diff, and posts the result as a PR comment with an inline GIF preview.

## Quick start

```bash
# Install globally (or use npx prdemo)
npm install -g prdemo

# Install browser engine (one-time)
npx playwright install chromium

# Set up in your project
cd your-project
prdemo init          # generates .prdemo.yml
cp .env.example .env # fill in OPENROUTER_API_KEY

# Run it
prdemo run
```

## Prerequisites

- **Node.js 20+**
- **TTS engine** — one of:
  - macOS `say` (built-in, zero setup)
  - [Piper](https://github.com/rhasspy/piper) (cross-platform, higher quality)
- **[OpenRouter](https://openrouter.ai) API key** — for LLM narration + inference

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | Your OpenRouter API key |
| `OPENROUTER_MODEL` | No | LLM model (default: `google/gemini-flash-1.5`) |
| `GITHUB_TOKEN` | For `--post` | GitHub PAT with `repo` scope |
| `PIPER_VOICE` | If using Piper | Path to `.onnx` voice model |
| `SAY_VOICE` | No | macOS voice name (default: Samantha) |
| `SAY_RATE` | No | macOS speech rate (default: 175) |

## Config reference (`.prdemo.yml`)

```yaml
# Required
start: npm run dev                    # Command to start your dev server
ready: http://localhost:3000          # URL to poll for readiness

# Optional
setup: npm install                    # Run before starting the server
output: demo.mp4                      # Output file path
model: google/gemini-flash-1.5        # Override LLM model
env: [.env.local]                     # Extra env files to load

viewport:
  width: 1280
  height: 720

# Auth flow (run before demo to log in)
auth:
  url: http://localhost:3000/login
  steps:
    - action: type
      selector: "input[name='email']"
      value: "${TEST_USER}"           # Env vars are interpolated
    - action: type
      selector: "input[name='password']"
      value: "${TEST_PASS}"
    - action: click
      selector: "text=Sign In"

# Demo script
demo:
  # Option A: Explicit steps
  script:
    - action: navigate
      value: /
      delay: 3000
      narrate: "Here's the app with the new sidebar layout."
    - action: click
      selector: "text=Share"
      narrate: "The share button sends tasks to selected contacts."

  # Option B: LLM-inferred steps (from diff)
  # infer: true
```

### Demo step actions

| Action | Fields | Description |
|---|---|---|
| `navigate` | `value` (path) | Go to a URL |
| `click` | `selector` | Click an element |
| `type` | `selector`, `value` | Fill an input |
| `scroll` | `scroll` (e.g. "down 400", "top") | Scroll the page |
| `wait` | `delay` (ms) | Pause |
| `go_back` | — | Browser back |
| `screenshot` | — | Marker only |

Every step supports `delay` (ms, default 3000) and `narrate` (text hint for the narrator LLM).

## CLI usage

```
prdemo init [options]
  -d, --project-dir <path>    Project directory (default: .)
  -p, --port <number>         Dev server port

prdemo run [options]
  -d, --project-dir <path>    Project directory (default: .)
  -p, --port <number>         Port override
  -s, --start-cmd <cmd>       Start command override
  -o, --output <path>         Output MP4 path
  --post                      Post video + GIF preview to GitHub PR
```

## How it works

1. Starts your dev server (`start` command)
2. Extracts the git diff and PR info from the repo
3. (If `demo.infer: true`) LLM generates demo steps from the diff
4. Records a browser session via Playwright (headless Chromium)
5. Sends diff + browser event log to an LLM for narration
6. Renders audio via Piper TTS or macOS `say`
7. Muxes video + audio with ffmpeg into a final MP4
8. (If `--post`) Generates a GIF preview and posts both to the GitHub PR

## Narration quality

The `narrate:` field on demo steps is the highest-leverage quality knob. These developer-authored hints become load-bearing inputs to the narrator LLM — they tell it *what matters* at each moment.

```yaml
- action: click
  selector: "text=Share"
  narrate: "The share button sends pending tasks to selected contacts via the new Sidebar component."
```

Without narrate hints, the LLM produces generic descriptions. With them, it connects on-screen moments to specific code changes.

## Development

```bash
git clone <repo>
cd pr-demo
npm install
npx playwright install chromium
cp .env.example .env

# Run directly (no build step)
npx tsx src/index.ts run --project-dir ./test-app

# Run narrator benchmark (20 PR fixtures)
npm run bench
```
