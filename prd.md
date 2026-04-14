

## 1. Problem

Code review is broken for anything visual or interactive. Reviewers skip local testing because setup friction is real — clone, install, migrate, seed, configure env, start, click around — and by the time you've done all that for a two-line CSS fix, you've lost an hour. So reviewers default to reading the diff and approving based on vibes. Bugs slip through, UX regressions ship, and stakeholders outside engineering (PMs, designers, founders) are locked out of the review loop entirely because they can't run the code at all.

Developers sometimes record Loom videos to compensate, but it's manual, inconsistent, and the first thing to get dropped when a sprint gets tight. The videos that do get made are often worse than useless — the dev forgets to show the important thing, rambles, or demos the happy path while the bug hides in an edge case.

There's a better shape here: the PR itself contains everything needed to produce a good demo automatically. The diff tells you what changed. The description tells you why. The code already runs on the developer's machine. An agent can drive a browser through the changed flows, and an LLM that has read the diff can narrate with more precision than a tired human at 6pm.

## 2. Goal

Ship a local-first CLI that, given a PR in a supported project, produces a 60–120 second narrated video demonstrating the change and attaches it as a PR comment — with zero ongoing manual effort per PR after one-time setup.

## 3. Non-goals (for v1)

- Running anything in a hosted cloud. Inference, recording, and rendering all happen locally.
- Replacing code review. The video supplements the diff; it doesn't gate merges.
- Backend-only / API-only changes. v1 is scoped to web UI changes where a browser demo makes sense.
- Supporting arbitrary stacks zero-config. v1 targets JavaScript/TypeScript web apps (Next.js, Vite, Remix, plain React) with a simple config file.
- Editing the video (cuts, zooms, highlights). v1 is straight-through capture plus audio overlay.

## 4. Target user

**Primary:** Individual engineers and small teams (2–15 devs) working on modern JS/TS web apps who care about review quality and already reach for tools like Playwright, Husky, or Storybook. The dev who'd install this is the same dev who writes meaningful commit messages.

**Secondary:** Engineering managers at mid-sized orgs evaluating "AI in the SDLC" tools — the Catalyst AI consulting audience. This group wants something concrete to point at, open-source to de-risk, and self-hosted so legal doesn't block it.

**Explicitly not the user in v1:** enterprise teams with complex multi-service setups, non-web projects, or teams that need a SaaS product with an admin panel.

## 5. User story

> As a developer opening a PR, I run `prdemo run` (or have it run automatically via a git hook), wait 60 seconds, and see a narrated video appear as a comment on my PR. My reviewer watches it instead of checking out my branch, understands the change in under two minutes, and leaves a more substantive review than they otherwise would have.

## 6. How it works

**One-time setup:**
1. `prdemo init` in the repo root. Generates a starter `.prdemo.yml` based on detected framework (Next.js, Vite, etc.) and prompts for the few things it can't infer.
2. User adds `OPENROUTER_API_KEY` to their `.env`.
3. Optional: install git hook or GitHub Action for automatic runs.

**Per-PR flow:**
1. User runs `prdemo run` (or a hook fires on `git push`).
2. CLI reads `.prdemo.yml`, loads env, runs `setup` command if needed.
3. CLI starts the app via the `start` command, polls the `ready` endpoint until healthy.
4. Playwright launches a headed-but-offscreen browser, runs the auth flow if configured, then executes the demo script (explicit steps or inferred from diff).
5. Playwright records video of the session and emits a structured event log (timestamps, actions, text snapshots).
6. Narrator module assembles a prompt from: PR title/description, diff, event log, inline `narrate:` anchors. Calls OpenRouter with user's key, requests JSON-structured output.
7. Local TTS (Piper by default) renders per-segment audio from the narration script.
8. ffmpeg muxes audio onto the video, aligned to event timestamps.
9. CLI posts the final MP4 to the PR as a comment via the GitHub API (user's token).

**What leaves the machine:** the prompt (diff + metadata + event log) goes to OpenRouter under the user's key. The video, code, and secrets never leave. TTS is local. The maintainer (us) has no servers in the path.

## 7. Config: `.prdemo.yml`

Minimal valid config is three lines. Full schema supports auth flows, sidecar services, explicit demo scripts with inline narration anchors, env file loading, viewport control, and inference model selection. `${ENV_VAR}` interpolation throughout so no secrets live in the YAML. (Full schema detailed in the design doc — the config covered in our earlier discussion is the v1 target.)

Key design principles:
- **Three-line happy path.** Most Next.js/Vite projects don't need more.
- **Explicit beats magical.** The `demo.script` path is the recommended default; `demo.infer: true` is the advanced, opt-in alternative.
- **Inline `narrate:` anchors.** Devs drop single-sentence callouts at meaningful moments. These become load-bearing inputs to the narrator and are the highest-leverage quality knob in the entire system.

## 8. The narrator (the actual moat)

The narrator is what makes this not-slop. The inputs, in descending order of importance:

1. PR title and description — human framing
2. The diff — ground truth of what changed
3. `narrate:` anchors from the demo script — intentional callouts
4. Structured Playwright event log — what happened when
5. Key screenshots — only when visual grounding is needed

The system prompt explicitly instructs the model to: reference the PR's stated purpose, connect on-screen moments to specific lines in the diff, never describe what's visually obvious, and stay under a target word budget per segment. Output is JSON with `{start, end, text}` segments aligned to the event log timestamps.

Structured output is validated with Zod; parse failures trigger one retry with a stricter reprompt before failing gracefully.

**Why this beats vision-model-over-video approaches:** a vision model sees pixels and produces "a button is clicked." A model that has read the diff produces "the Save button now disables during submission — that's the duplicate-invoice fix this PR is for." The diff is the secret weapon.

## 9. Tech stack

- **CLI:** Node + TypeScript (developer ergonomics, native Playwright integration, ships to npm)
- **Browser automation + recording:** Playwright (built-in video capture, robust selectors, good event model)
- **Inference:** OpenRouter via user's API key, structured JSON output, configurable model per run
- **TTS:** Piper (local, CPU, bundled) as default; optional ElevenLabs key for premium voices
- **Video muxing:** ffmpeg (bundled via `ffmpeg-static`)
- **GitHub integration:** Octokit, user's PAT from env
- **Distribution:** `npm i -g prdemo` for v1; Homebrew and standalone binaries later

## 10. Success metrics

**v0 (works on my machine — weeks 1–3):** One command produces a watchable narrated MP4 for a real Next.js project. No config schema, no GitHub posting, hardcoded demo script. Internal dogfood only.

**v0.5 (alpha — weeks 4–8):** Config schema stable. Runs on 5 external alpha projects without custom code per project. Narration quality judged "useful, not just describes-the-obvious" in ≥70% of test PRs by the alpha users.

**v1 (public launch):**
- Install-to-first-working-video under 10 minutes on a fresh Next.js project
- ≥50% of alpha users continue using it voluntarily after 2 weeks
- Narration references something from the diff (not just on-screen events) in ≥80% of runs
- Total per-run cost under $0.10 at default model settings
- 500+ GitHub stars within 30 days of launch (soft signal but matters for Catalyst AI positioning)

## 11. Risks and open questions

**Environment setup is the killer.** Every repo is a snowflake. The `.prdemo.yml` design tries to contain this but reality will push back hard. Mitigation: scope v1 tightly to Next.js/Vite, require explicit config, don't promise zero-config. Resist the temptation to add "framework auto-detection magic" before the core narration loop is actually good.

**Narration quality is existential.** If the LLM produces generic slop, users will turn the tool off after two PRs and never come back. Mitigation: invest disproportionately in the narrator system prompt and the `narrate:` anchor pattern. Ship with a curated benchmark of 20 PRs and regressions-test the narrator against them on every prompt change.

**Demo script authoring is a cost.** Asking devs to write a Playwright-ish config per repo is friction. Mitigation: `prdemo init` generates a smart starter; inference mode exists as a fallback; the payoff (free narrated videos on every PR forever) is clearly worth the one-time setup.

**GitHub's 100MB PR comment limit.** Should be fine for 120-second 1280x800 videos with reasonable encoding, but worth verifying early. Fallback: upload to a user-specified S3 bucket and post a link.

**Open-source vs. commercial tension.** If it's OSS, what's the business model? Answer: open-core. CLI is MIT. Paid cloud runner for teams that don't want to maintain self-hosted CI integration. Consulting services via Catalyst AI for teams adopting this and similar AI-in-SDLC tools. The OSS tool is both a product and a credibility artifact.

**Flaky `npm install`s and environment drift.** Inherited the moment we go local. Accepted cost — the trust story is worth it.

## 12. Milestones

- **Week 1–2:** Spike. Hardcoded demo on one real Next.js repo. End-to-end: start app → Playwright run → OpenRouter call → Piper TTS → ffmpeg mux → MP4 on disk. No config, no GitHub.
- **Week 3–4:** Config schema v1. `prdemo init`. Env loading. Auth flow support. Runs on three internal projects.
- **Week 5–6:** GitHub integration. PR comment posting. `narrate:` anchor pattern. Narrator prompt hardened against the 20-PR benchmark.
- **Week 7–8:** Alpha with 5 external users. Iterate hard on narrator quality based on real feedback.
- **Week 9–10:** Polish, docs, landing page, launch post. Public v1.

## 13. What this is not trying to be

It's not trying to be a full test runner, a replacement for Storybook, an E2E testing framework, or a video editing tool. It's trying to be the thing that makes code review 30% better for visual changes, by doing one narrow thing extraordinarily well: producing a good 90-second narrated demo video with zero per-PR effort after setup.

If v1 does that for Next.js projects and nothing else, it's a success.
