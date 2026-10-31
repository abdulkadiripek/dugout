import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnReal, processLines } from "./spawn.js";
import { scripted } from "./test-helper.js";

let cwd: string;
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "dugout-spawn-")); });
afterEach(async () => { vi.useRealTimers(); await rm(cwd, { recursive: true, force: true }); });
it("splits chunks and CRLF, retains a final partial line, captures stderr and exit", async () => {
  const child = spawnReal("sh", ["-c", "printf 'one'; sleep 0.02; printf '\\ntwo\\r\\nlast'; printf 'failure' >&2; exit 7"], { cwd });
  const lines: string[] = [];
  for await (const line of child.lines) lines.push(line);
  expect(lines).toEqual(["one", "two", "last"]);
  expect(await child.exited).toEqual({ code: 7, signal: null });
  expect(child.stderr()).toBe("failure");
});
it("ignores stdin, uses the supplied cwd, and caps stderr at 64 KB", async () => {
  const child = spawnReal("sh", ["-c", "if read value; then exit 2; fi; pwd; i=0; while [ $i -lt 700 ]; do printf '%s' '" + "x".repeat(100) + "' >&2; i=$((i+1)); done"], { cwd });
  const lines: string[] = [];
  for await (const line of child.lines) lines.push(line);
  expect(await child.exited).toEqual({ code: 0, signal: null });
  expect(lines).toEqual([cwd]);
  expect(Buffer.byteLength(child.stderr())).toBe(65536);
});
it("reports spawn errors", async () => {
  const child = spawnReal("sh", ["-c", "true"], { cwd: join(cwd, "missing") });
  await expect(child.exited).rejects.toThrow();
});
it("terminates a shell and its sleep descendant using only their process group", async () => {
  const child = spawnReal("sh", ["-c", 'sleep 30 & echo "$!"; wait'], { cwd });
  try {
    const first = await child.lines[Symbol.asyncIterator]().next();
    const pid = Number(first.value);
    expect(pid).toBeGreaterThan(0);
    child.killGroup("SIGTERM");
    expect(await child.exited).toEqual({ code: null, signal: "SIGTERM" });
    // The shell can report its exit before its descendant has handled SIGTERM, and Linux may keep a killed orphan as a zombie.
    const gone = async () => {
      try { return (await readFile(`/proc/${pid}/stat`, "utf8")).split(") ")[1]?.startsWith("Z ") === true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return true; throw error; }
    };
    const deadline = Date.now() + 3000;
    while (!(await gone()) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await gone()).toBe(true);
  } finally { child.killGroup("SIGKILL"); }
});
it("escalates after two seconds even when a scripted process never exits", async () => {
  vi.useFakeTimers();
  const child = scripted([], 0, true);
  const lines = processLines(child, new AbortController().signal, 5);
  const result = lines.next();
  await vi.advanceTimersByTimeAsync(5);
  expect(await result).toEqual({ done: true, value: "timeout" });
  expect(child.kills).toEqual(["SIGTERM"]);
  await vi.advanceTimersByTimeAsync(1999);
  expect(child.kills).toEqual(["SIGTERM"]);
  await vi.advanceTimersByTimeAsync(1);
  expect(child.kills).toEqual(["SIGTERM", "SIGKILL"]);
});
it("blocks real claude and codex under vitest without spawning", () => {
  expect(() => spawnReal("claude", [], { cwd })).toThrow(/blocked under vitest.*inject a spawn/);
  expect(() => spawnReal("/usr/bin/codex", [], { cwd })).toThrow(/blocked under vitest.*inject a spawn/);
});
it("leaves other commands alone under vitest and outside it", async () => {
  const saved = process.env.VITEST;
  try {
    const inside = spawnReal("sh", ["-c", "exit 0"], { cwd });
    expect(await inside.exited).toEqual({ code: 0, signal: null });
    delete process.env.VITEST;
    const outside = spawnReal("sh", ["-c", "exit 3"], { cwd });
    expect(await outside.exited).toEqual({ code: 3, signal: null });
  } finally {
    if (saved === undefined) delete process.env.VITEST; else process.env.VITEST = saved;
  }
});
