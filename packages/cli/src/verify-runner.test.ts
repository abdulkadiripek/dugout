import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runVerifyCommand } from "./verify-runner.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "panosu-verify-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("passes in the supplied cwd and merges stderr in output order", async () => {
  const result = await runVerifyCommand(dir, "pwd; printf 'one\\n'; printf 'two\\n' >&2; printf 'three\\n'", { timeoutMs: 5000 });
  expect(result.passed).toBe(true);
  expect(result.exitCode).toBe(0);
  expect(result.outputTail).toBe(`${dir}\none\ntwo\nthree`);
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
});
it("reports a failing exit code and partial final line", async () => {
  const result = await runVerifyCommand(dir, "printf 'failure' >&2; exit 7", { timeoutMs: 5000 });
  expect(result).toMatchObject({ passed: false, exitCode: 7, outputTail: "failure" });
});
it("retains only the last 30 of 100 lines", async () => {
  const result = await runVerifyCommand(dir, 'i=1; while [ "$i" -le 100 ]; do echo "$i"; i=$((i+1)); done', { timeoutMs: 5000 });
  expect(result.outputTail.split("\n")).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 71)));
});
it("times out and terminates descendants before they can write a marker", async () => {
  const result = await runVerifyCommand(dir, "(sleep 0.5; touch marker) & sleep 30; wait", { timeoutMs: 100 });
  expect(result).toMatchObject({ passed: false, exitCode: 124 });
  expect(result.outputTail.split("\n").at(-1)).toBe("Command timed out");
  expect(result.durationMs).toBeGreaterThanOrEqual(100);
  expect(existsSync(join(dir, "marker"))).toBe(false);
});
it("escalates to SIGKILL for a descendant that ignores SIGTERM", async () => {
  const result = await runVerifyCommand(dir, "(trap '' TERM; sleep 2.5; touch survivor) & wait", { timeoutMs: 100 });
  expect(result.exitCode).toBe(124);
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(existsSync(join(dir, "survivor"))).toBe(false);
});
it("aborts and terminates descendants", async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    const result = await runVerifyCommand(dir, "(sleep 0.5; touch marker) & sleep 30; wait", { timeoutMs: 5000, signal: controller.signal });
    expect(result).toMatchObject({ passed: false, exitCode: 130 });
    expect(result.outputTail.split("\n").at(-1)).toBe("Command aborted");
    expect(existsSync(join(dir, "marker"))).toBe(false);
  } finally {
    clearTimeout(timer);
  }
});
it("does not start a command for a signal already aborted", async () => {
  const result = await runVerifyCommand(dir, "touch marker", { timeoutMs: 5000, signal: AbortSignal.abort() });
  expect(result.exitCode).toBe(130);
  expect(existsSync(join(dir, "marker"))).toBe(false);
});
it("rejects spawn failures", async () => {
  await expect(runVerifyCommand(join(dir, "missing"), "true", { timeoutMs: 5000 })).rejects.toThrow();
});
it("terminates processes left in the group after the command exits by itself", async () => {
  const result = await runVerifyCommand(dir, "sleep 30 & echo $! > pid; exit 3", { timeoutMs: 20000 });
  expect(result).toMatchObject({ passed: false, exitCode: 3 });
  const pid = Number(readFileSync(join(dir, "pid"), "utf8"));
  const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  for (let i = 0; i < 30 && alive(); i++) await new Promise(resolve => setTimeout(resolve, 100));
  expect(alive()).toBe(false);
});
