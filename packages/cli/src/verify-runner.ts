import { spawn } from "node:child_process";
import type { VerifyOutcome } from "@panosu/core";

export interface VerifyOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

export function runVerifyCommand(cwd: string, command: string, opts: VerifyOptions): Promise<VerifyOutcome> {
  const started = performance.now();
  if (opts.signal?.aborted) {
    return Promise.resolve({ passed: false, exitCode: 130, durationMs: 0, outputTail: "Command aborted" });
  }
  return new Promise((resolve, reject) => {
    // Redirect before executing the command so both streams share one ordered pipe.
    const child = spawn("sh", ["-c", 'exec 2>&1; exec sh -c "$1"', "panosu-verify", command], {
      cwd, detached: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let tail = "";
    let stopped: number | undefined;
    let closed = false;
    let cleanupDone = true;
    let code: number | null = null;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const capture = (chunk: string) => {
      tail = (tail + chunk).split("\n").slice(-31).join("\n");
    };
    child.stdout.setEncoding("utf8").on("data", capture);
    child.stderr.setEncoding("utf8").on("data", capture);
    const signalGroup = (signal: NodeJS.Signals) => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    const finish = () => {
      if (!closed || !cleanupDone) return;
      clearTimeout(timeout);
      opts.signal?.removeEventListener("abort", abort);
      const lines = tail.endsWith("\n") ? tail.slice(0, -1).split("\n") : tail.split("\n");
      if (stopped) lines.push(stopped === 124 ? "Command timed out" : "Command aborted");
      const exitCode = stopped ?? code ?? 1;
      resolve({ passed: exitCode === 0, exitCode, durationMs: performance.now() - started, outputTail: lines.slice(-30).join("\n") });
    };
    const stop = (exitCode: number) => {
      if (stopped !== undefined || closed) return;
      stopped = exitCode;
      cleanupDone = false;
      signalGroup("SIGTERM");
      // The shell can exit while descendants still live in its process group.
      killTimer = setTimeout(() => {
        signalGroup("SIGKILL");
        cleanupDone = true;
        finish();
      }, 2000);
    };
    const abort = () => stop(130);
    const timeout = setTimeout(() => stop(124), opts.timeoutMs);
    opts.signal?.addEventListener("abort", abort, { once: true });
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      opts.signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (exitCode) => {
      closed = true;
      code = exitCode;
      finish();
    });
  });
}
