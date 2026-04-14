# prdemo

CLI that produces narrated demo videos from pull requests.

**v0 — spike / proof of concept.** Hardcoded to a single Next.js project.

## Prerequisites

- Node.js 20+
- [Piper TTS](https://github.com/rhasspy/piper) binary installed and on PATH
- A Piper voice model (default: `en_US-lessac-medium.onnx`)
- An [OpenRouter](https://openrouter.ai) API key

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Fill in OPENROUTER_API_KEY in .env
```

## Usage

```bash
# Run against a local project
npx tsx src/index.ts run --project-dir /path/to/next-app

# Or after building
npm run build
prdemo run --project-dir /path/to/next-app
```

## How it works

1. Starts the target app's dev server
2. Records a browser demo via Playwright
3. Extracts the git diff from the target repo
4. Sends diff + event log to an LLM via OpenRouter for narration
5. Renders narration audio with Piper TTS
6. Muxes video + audio with ffmpeg into a final MP4
