import { spawn, type ChildProcess } from "node:child_process";

export interface AppHandle {
  process: ChildProcess;
  port: number;
}

export function startApp(
  projectDir: string,
  startCmd: string,
  port: number
): AppHandle {
  const [cmd, ...args] = startCmd.split(" ");
  const child = spawn(cmd, args, {
    cwd: projectDir,
    stdio: "pipe",
    detached: true,
    env: { ...process.env, PORT: String(port) },
  });

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[app] ${data.toString()}`);
  });
  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[app] ${data.toString()}`);
  });

  return { process: child, port };
}

export async function waitForReady(
  url: string,
  timeoutMs = 30_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`App did not become ready at ${url} within ${timeoutMs}ms`);
}

export function stopApp(handle: AppHandle): void {
  if (handle.process.pid) {
    try {
      // Kill the process group
      process.kill(-handle.process.pid, "SIGTERM");
    } catch {
      // Process may have already exited
      handle.process.kill("SIGTERM");
    }
  }
}
