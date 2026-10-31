import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export interface SpawnedProcess {
  lines: AsyncIterable<string>;
  stderr(): string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  killGroup(signal: NodeJS.Signals): void;
}
export type SpawnFn = (command: string, args: string[], opts: { cwd: string }) => SpawnedProcess;

export const spawnReal: SpawnFn = (command, args, opts) => {
  const child = spawn(command, args, { cwd: opts.cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const lines = reader[Symbol.asyncIterator]();
  const chunks: Buffer[] = [];
  let size = 0;
  child.stderr.on("data", (chunk: Buffer) => {
    const kept = chunk.subarray(0, Math.max(0, 65536 - size));
    if (kept.length) chunks.push(kept);
    size += kept.length;
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  // A spawn error can arrive before the caller starts awaiting exit.
  void exited.catch(() => {});
  return {
    lines, exited, stderr: () => Buffer.concat(chunks).toString("utf8"),
    killGroup(signal) {
      if (child.pid === undefined) return;
      try { process.kill(-child.pid, signal); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    },
  };
};

export async function* processLines(child: SpawnedProcess, signal: AbortSignal, timeoutMs: number): AsyncGenerator<string, "ok" | "crash" | "timeout"> {
  let timedOut = false;
  let stop!: () => void;
  const stopped = new Promise<null>(resolve => { stop = () => {
    if (timedOut) return;
    timedOut = true;
    child.killGroup("SIGTERM");
    // Descendants may survive the parent and still need escalation.
    setTimeout(() => child.killGroup("SIGKILL"), 2000).unref();
    resolve(null);
  }; });
  const timer = setTimeout(stop, timeoutMs);
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  const exit = child.exited.then(value => ({ value }), () => ({ value: { code: 1, signal: null } }));
  // A dying process may still have its final lines buffered (a usage-limit error is printed right before exit 1).
  const failed = exit.then(({ value }) => value.code !== 0 || value.signal !== null
    ? new Promise<null>(resolve => { setTimeout(() => resolve(null), 250).unref(); })
    : new Promise<never>(() => {}));
  try {
    const iterator = child.lines[Symbol.asyncIterator]();
    while (!timedOut) {
      const next = await Promise.race([iterator.next(), stopped, failed]);
      if (next === null) return timedOut ? "timeout" : "crash";
      if (next.done) break;
      yield next.value;
    }
    const result = await Promise.race([exit, stopped]);
    if (timedOut || result === null) return "timeout";
    return result.value.code === 0 && result.value.signal === null ? "ok" : "crash";
  } catch {
    return timedOut ? "timeout" : "crash";
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}
