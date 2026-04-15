import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

// ---------- Schema ----------

const DemoStepSchema = z.object({
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
  /** e.g. "down 400" or "top" */
  scroll: z.string().optional(),
  /** ms to wait (for "wait" action, or pause after any action) */
  delay: z.number().optional(),
  /** Inline narration anchor — becomes a load-bearing LLM hint */
  narrate: z.string().optional(),
});

export type DemoStep = z.infer<typeof DemoStepSchema>;

const AuthFlowSchema = z.object({
  /** URL of the login page */
  url: z.string(),
  steps: z.array(DemoStepSchema),
});

const FrameSchema = z.object({
  /** Enable browser-style framing */
  enabled: z.boolean().default(false),
  /** Render frame in-browser during recording for speed */
  inBrowser: z.boolean().default(false),
  /** Use fast post-processing path when framing in ffmpeg */
  fast: z.boolean().default(true),
  /** Outer margin around browser window */
  margin: z.number().default(50),
  /** Inner padding between window chrome and app content */
  contentInset: z.number().default(25),
  /** Browser top bar height */
  barHeight: z.number().default(44),
  /** Background image path (relative to project dir) */
  backgroundImage: z.string().default("foo.jpg"),
});

const ConfigSchema = z.object({
  /** Command to start the dev server (default: "npm run dev") */
  start: z.string().default("npm run dev"),
  /** URL (or port) the dev server listens on (default: "http://localhost:3000") */
  ready: z.string().default("http://localhost:3000"),
  /** Setup command run before starting (e.g. "npm install") */
  setup: z.string().optional(),
  /** Optional browser-style framing */
  frame: FrameSchema.optional(),
  /** Auth flow — run before demo to log in */
  auth: AuthFlowSchema.optional(),
  /** Demo script steps. If omitted, a basic auto-explore is used. */
  demo: z.object({
    /** Explicit steps to execute */
    script: z.array(DemoStepSchema).optional(),
    /** Let the LLM infer demo steps from the diff (advanced, opt-in) */
    infer: z.boolean().optional(),
  }).default({}),
  /** Viewport dimensions */
  viewport: z.object({
    width: z.number().default(1280),
    height: z.number().default(720),
  }).default({ width: 1280, height: 720 }),
  /** Env files to load (in order) */
  env: z.array(z.string()).optional(),
  /** OpenRouter model override */
  model: z.string().optional(),
  /** Output file path */
  output: z.string().optional(),
});

export type PrdemoConfig = z.infer<typeof ConfigSchema>;

// ---------- Loader ----------

const CONFIG_FILENAMES = [".prdemo.yml", ".prdemo.yaml", "prdemo.yml", "prdemo.yaml"];

/**
 * Load and validate .prdemo.yml from the project directory.
 * Returns null if no config file is found.
 */
export function loadConfig(projectDir: string): PrdemoConfig | null {
  for (const name of CONFIG_FILENAMES) {
    const filePath = path.join(projectDir, name);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = parseYaml(raw);

      // Interpolate ${ENV_VAR} references
      const interpolated = interpolateEnv(data);

      const result = ConfigSchema.safeParse(interpolated);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `  ${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`Invalid config in ${name}:\n${issues}`);
      }
      return result.data;
    }
  }
  return null;
}

/**
 * Resolve the ready URL from config. Accepts full URL or just a port number.
 */
export function resolveReadyUrl(ready: string): { url: string; port: number } {
  // If it's just a number, treat as port
  if (/^\d+$/.test(ready)) {
    const port = parseInt(ready, 10);
    return { url: `http://localhost:${port}`, port };
  }
  // Full URL — extract port
  try {
    const parsed = new URL(ready);
    const port = parsed.port ? parseInt(parsed.port, 10) : 3000;
    return { url: ready, port };
  } catch {
    throw new Error(`Invalid ready URL: ${ready}`);
  }
}

// ---------- Generator (prdemo init) ----------

interface InitOptions {
  framework: "nextjs" | "vite" | "remix" | "other";
  startCmd?: string;
  port?: number;
}

export function generateConfig(opts: InitOptions): string {
  const config: Record<string, unknown> = {};

  switch (opts.framework) {
    case "nextjs":
      config.start = opts.startCmd || "npm run dev";
      config.ready = `http://localhost:${opts.port || 3000}`;
      break;
    case "vite":
      config.start = opts.startCmd || "npm run dev";
      config.ready = `http://localhost:${opts.port || 5173}`;
      break;
    case "remix":
      config.start = opts.startCmd || "npm run dev";
      config.ready = `http://localhost:${opts.port || 3000}`;
      break;
    default:
      config.start = opts.startCmd || "npm run dev";
      config.ready = `http://localhost:${opts.port || 3000}`;
  }

  config.demo = {
    script: [
      { action: "navigate", value: "/", delay: 3000, narrate: "Here's the app in its current state." },
      { action: "wait", delay: 5000, narrate: "Let's see what this PR changes." },
    ],
  };

  return stringifyYaml(config, { lineWidth: 100 });
}

// ---------- Framework detection ----------

export function detectFramework(projectDir: string): InitOptions["framework"] {
  const pkgPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgPath)) return "other";

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["next"]) return "nextjs";
    if (deps["vite"]) return "vite";
    if (deps["@remix-run/dev"] || deps["remix"]) return "remix";
  } catch {
    // ignore
  }
  return "other";
}

// ---------- Env interpolation ----------

function interpolateEnv(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
      return process.env[name] ?? "";
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateEnv);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateEnv(value);
    }
    return result;
  }
  return obj;
}
