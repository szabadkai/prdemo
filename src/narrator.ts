import OpenAI from "openai";
import { z } from "zod";
import type { EventLogEntry, NarrationSegment, PRInfo } from "./types.js";

const NarrationSchema = z.object({
  segments: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      text: z.string(),
    })
  ),
});

const SYSTEM_PROMPT = `You are a narrator for developer PR demo videos. You produce narration scripts that accompany screen recordings of web application changes.

Your inputs are:
1. PR info (branch name, commit message) — the human framing of the change
2. The git diff — ground truth of what changed in the code
3. A structured event log from a Playwright browser session — what happened on screen and when (timestamps in ms)

Your output is a JSON object with a "segments" array. Each segment has:
- "start": timestamp in ms when narration should begin (aligned to event log)
- "end": timestamp in ms when narration should end
- "text": the narration text for that segment

Rules:
- Reference the PR's stated purpose early in the narration.
- Connect on-screen moments to specific changes in the diff. Say what changed in the code, not just what's visible.
- Never describe what's visually obvious (e.g. don't say "a page loads" — say what the page now does differently).
- Keep each segment under 30 words.
- Total narration should be 60-120 seconds of speaking time (~150-300 words total).
- Make segments flow naturally as a cohesive narration.
- Use a professional but conversational tone.
- Output ONLY the JSON object, no other text.`;

export async function generateNarration(
  diff: string,
  eventLog: EventLogEntry[],
  prInfo: PRInfo
): Promise<NarrationSegment[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  // Model options (set via OPENROUTER_MODEL env var):          input/output per 1M tokens
  //   google/gemini-flash-1.5        — $0.075 / $0.30   — fast, good at JSON
  //   google/gemini-flash-2.0        — $0.10  / $0.40   — newer, slightly better
  //   deepseek/deepseek-chat-v3.1    — $0.15  / $0.75   — 671B MoE, great value
  //   deepseek/deepseek-v3.2         — $0.26  / $0.38   — latest DeepSeek, GPT-5 class
  //   openai/gpt-4o-mini             — $0.15  / $0.60   — solid all-rounder
  //   moonshotai/kimi-k2.5           — $0.38  / $1.72   — strong multimodal + agentic
  //   moonshotai/kimi-k2-0905        — $0.40  / $2.00   — 1T params, long context
  //   meta-llama/llama-3.1-70b       — $0.40  / $0.40   — open-source, good quality
  //   anthropic/claude-3.5-haiku     — $0.80  / $4.00   — great at following instructions
  //   openai/gpt-4o                  — $2.50  / $10.00  — premium quality
  //   anthropic/claude-sonnet-4      — $3.00  / $15.00  — best at structured output
  const model = process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5";

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const userPrompt = `## PR Info
Branch: ${prInfo.branch}
Commit message: ${prInfo.commitMessage}

## Git Diff
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

## Event Log
\`\`\`json
${JSON.stringify(eventLog, null, 2)}
\`\`\`

Generate the narration segments JSON.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    if (attempt > 0) {
      messages.push({
        role: "user",
        content:
          'Your previous response was not valid JSON. Return ONLY a JSON object with a "segments" array. No markdown, no explanation.',
      });
    }

    console.log(
      `  Calling ${model}${attempt > 0 ? " (retry)" : ""}...`
    );

    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("  Empty response from LLM");
      continue;
    }

    try {
      const parsed = JSON.parse(content);
      const validated = NarrationSchema.parse(parsed);
      return validated.segments;
    } catch (err) {
      console.error(
        `  Failed to parse narration (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  throw new Error("Failed to generate valid narration after 2 attempts");
}
