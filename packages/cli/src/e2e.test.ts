import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { invoke, packageFile, readEvents, setup } from "./test-helpers.js";

async function until(check: () => boolean, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Polling deadline exceeded");
    await delay(25);
  }
}
function signalGroup(pid: number, signal: NodeJS.Signals | 0) {
  try { process.kill(-pid, signal); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}
it.each(["SIGKILL", "SIGTERM"] as const)("handles %s during verify", async (signal) => {
  const ctx = await setup();
  const pidfile = join(ctx.dir, "verify.pid");
  packageFile(ctx.file, { verify: `echo $$ > '${pidfile}'; sleep 30` });
  const child = spawn(process.execPath, [fileURLToPath(new URL("../dist/bin.js", import.meta.url)), "delegate", ctx.file, "--scenario", "success", "--events-dir", ctx.events], {
    cwd: ctx.repo, detached: true, env: { ...process.env, HOME: ctx.dir }, stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, exitSignal) => resolve({ code, signal: exitSignal }));
  });
  let verifyPid: number | undefined;
  try {
    await until(() => existsSync(pidfile) && existsSync(ctx.events) && readdirSync(ctx.events).some((file) => readFileSync(join(ctx.events, file), "utf8").includes('"verify.started"')));
    verifyPid = Number(readFileSync(pidfile, "utf8").trim());
    expect(verifyPid).toBeGreaterThan(1);
    child.kill(signal);
    const exit = await closed;
    expect(stderr).toBe("");
    expect(exit).toEqual(signal === "SIGKILL" ? { code: null, signal: "SIGKILL" } : { code: 130, signal: null });
    const file = readdirSync(ctx.events)[0];
    if (!file) throw new Error("Missing log");
    expect(readEvents(join(ctx.events, file)).some((event) => event.type === "task.finished")).toBe(false);
    expect((await invoke(ctx, ["list", "--events-dir", ctx.events])).stdout).toContain("interrupted");
    if (signal === "SIGTERM") await until(() => !signalGroup(verifyPid as number, 0));
  } finally {
    if (verifyPid === undefined && existsSync(pidfile)) verifyPid = Number(readFileSync(pidfile, "utf8").trim());
    if (verifyPid !== undefined) signalGroup(verifyPid, "SIGKILL");
    if (child.pid !== undefined) signalGroup(child.pid, "SIGKILL");
    await closed;
    try {
      if (verifyPid !== undefined) await until(() => !signalGroup(verifyPid as number, 0));
    } finally {
      rmSync(ctx.dir, { recursive: true, force: true });
    }
  }
}, 30000);
