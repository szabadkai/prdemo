import OpenAI from "openai";
import { z } from "zod";
import type { PRInfo } from "./types.js";
import type { DemoStep } from "./config.js";

const InferredStepSchema = z.object({
  action: z.enum([
    "navigate",
    "click",
    "type",
    "scroll",
    "wait",
    "screenshot",
    "go_back",
  ]),
  selector: z.string().optional(),
  value: z.string().optional(),
  scroll: z.string().optional(),
  delay: z.number().optional(),
  narrate: z.string().optional(),
});

const InferResponseSchema = z.object({
  steps: z.array(InferredStepSchema),
});

const SYSTEM_PROMPT = `You are a demo script generator for a tool that records narrated videos of web app pull requests.

Given a git diff and PR info, generate a Playwright-style demo script that showcases the changes introduced by the PR. The script drives a browser to demonstrate the new or changed functionality.

Output a JSON object with a "steps" array. Each step has:
- "action": one of "navigate", "click", "type", "scroll", "wait", "screenshot", "go_back"
- "selector": CSS selector or text selector (for click/type). Use text-based selectors like "text=Button Label" or descriptive CSS selectors. Prefer visible text selectors.
- "value": for navigate (URL path like "/" or "/about") or type (text to enter)
- "scroll": for scroll (e.g. "down 400" or "top")
- "delay": pause in ms after this step (default 3000 if omitted)
- "narrate": a short sentence describing what the viewer should notice at this step. THIS IS CRITICAL — add a narrate to every meaningful step.

Rules:
1. Start with a navigate to "/" (or the most relevant page for the change).
2. Focus on the CHANGED functionality — click the new buttons, visit the new pages, interact with new UI elements.
3. Keep it to 6-12 steps total (30-90 seconds of demo).
4. Use realistic selectors based on what you see in the diff (component names, text content, aria labels).
5. If the diff adds a new page/route, navigate to it.
6. If the diff adds interactive elements (buttons, forms, modals), interact with them.
7. Add "narrate" anchors that connect the on-screen action to the code change. Reference WHAT changed and WHY, not just what's visible.
8. Don't navigate to external URLs. Only use paths within the app.
9. Prefer "text=..." selectors for robustness.
10. End with a navigate back to the main page or a go_back if you navigated away.

Output ONLY the JSON object, no other text.`;

export async function inferDemoScript(
  diff: string,
  prInfo: PRInfo,
  baseUrl: string,
  opts: { diffCharLimit?: number } = {}
): Promise<DemoStep[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const model =
    process.env.OPENROUTER_MODEL_INFER ||
    process.env.OPENROUTER_MODEL ||
    "google/gemini-2.0-flash-001";

  const diffLimit = opts.diffCharLimit ?? 12_000;

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const userPrompt = `## PR Info
Branch: ${prInfo.branch}
Commit message: ${prInfo.commitMessage}

## Base URL
${baseUrl}

## Git Diff
\`\`\`diff
${diff.slice(0, diffLimit)}
\`\`\`

Generate a demo script that showcases these changes.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    if (attempt > 0) {
      messages.push({
        role: "user",
        content:
          'Your previous response was not valid JSON. Return ONLY a JSON object with a "steps" array. No markdown, no explanation.',
      });
    }

    console.log(
      `  Inferring demo script via ${model}${attempt > 0 ? " (retry)" : ""}...`
    );

    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("  Empty response from LLM");
      continue;
    }

    try {
      const parsed = JSON.parse(content);
      const rawSteps = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.steps)
          ? parsed.steps
          : null;
      if (!rawSteps) {
        throw new Error('Response missing "steps" array');
      }
      const valid: DemoStep[] = [];
      const dropped: string[] = [];
      for (let i = 0; i < rawSteps.length; i++) {
        const r = InferredStepSchema.safeParse(rawSteps[i]);
        if (r.success) valid.push(r.data);
        else dropped.push(`step ${i}: ${r.error.issues[0]?.message || "invalid"}`);
      }
      if (valid.length === 0) {
        throw new Error(`No valid steps (dropped: ${dropped.join("; ")})`);
      }
      if (dropped.length > 0) {
        console.log(`  Dropped ${dropped.length} invalid step(s): ${dropped.join("; ")}`);
      }
      return valid;
    } catch (err) {
      console.error(
        `  Failed to parse inferred script (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : err
      );
    }
  }

  throw new Error("Failed to infer demo script after 2 attempts");
}
