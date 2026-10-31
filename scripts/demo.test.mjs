import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = join(dirname(fileURLToPath(import.meta.url)), "demo.mjs");

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("demo script", () => {
  it("serves the fixtures through the web proxy and leaves no children", () => {
    const result = spawnSync("node", [script, "--api-port", "0", "--web-port", "0", "--check"], { encoding: "utf8", timeout: 55000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^demo ready: http:\/\/127\.0\.0\.1:\d+$/m);
    expect(result.stdout).toMatch(/^demo check ok: [1-9]\d* tasks$/m);
    const pids = result.stdout.match(/^child pids: (\d+) (\d+)$/m)?.slice(1).map(Number);
    expect(pids).toHaveLength(2);
    for (const pid of pids) expect(alive(pid), `pid ${pid}`).toBe(false);
  }, 60000);

  it("moves to the next free port when the requested one is busy", async () => {
    const blocker = createServer();
    await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
    const busy = blocker.address().port;
    try {
      const child = spawn("node", [script, "--api-port", "0", "--web-port", String(busy), "--check"], { stdio: ["ignore", "pipe", "inherit"] });
      let stdout = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      await new Promise((resolve) => child.once("exit", resolve));
      expect(child.exitCode).toBe(0);
      const ready = stdout.match(/^demo ready: http:\/\/127\.0\.0\.1:(\d+)$/m);
      expect(ready).not.toBeNull();
      expect(Number(ready[1])).not.toBe(busy);
    } finally {
      blocker.close();
    }
  }, 60000);

  it("checks live mode against a given events dir, accepts --open without opening", () => {
    const fixtures = join(dirname(script), "..", "fixtures/events");
    const dir = mkdtempSync(join(tmpdir(), "dugout-live-"));
    try {
      const name = readdirSync(fixtures).find((f) => f.endsWith(".jsonl"));
      copyFileSync(join(fixtures, name), join(dir, name));
      const result = spawnSync("node", [script, "--live", "--open", "--events-dir", dir, "--api-port", "0", "--web-port", "0", "--check"], { encoding: "utf8", timeout: 55000 });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/^demo check ok: 1 tasks$/m);
      expect(result.stdout).toContain(`events: ${dir}\n`);
      expect(result.stdout).toContain("stop with Ctrl+C");
      const pids = result.stdout.match(/^child pids: (\d+) (\d+)$/m)?.slice(1).map(Number);
      expect(pids).toHaveLength(2);
      for (const pid of pids) expect(alive(pid), `pid ${pid}`).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
