import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invoke, readEvents, setup } from "./test-helpers.js";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { ctx = await setup(); mkdirSync(ctx.events); });
afterEach(() => rmSync(ctx.dir, { recursive: true, force: true }));
const fixture = readEvents(new URL("../../../fixtures/events/success.jsonl", import.meta.url).pathname);
function save(name: string, events: unknown[]) {
  writeFileSync(join(ctx.events, name + ".jsonl"), events.map((event) => JSON.stringify(event)).join("\n") + "\n");
}
it("orders by creation timestamp, limits, and reports interrupted attempts", async () => {
  save("old", fixture.map((event) => ({ ...event, taskId: "old" })));
  save("new", fixture.slice(0, 4).map((event) => ({ ...event, taskId: "new", ts: "2026-02-01T00:00:00.000Z" })));
  const result = await invoke(ctx, ["list", "--events-dir", ctx.events]);
  expect(result).toEqual({ code: 0, stderr: "", stdout: "new  interrupted  1 attempts  codex\nold  passed  1 attempts  codex\n" });
  expect((await invoke(ctx, ["list", "--events-dir", ctx.events, "--limit", "1"])).stdout).toBe("new  interrupted  1 attempts  codex\n");
  expect((await invoke(ctx, ["list", "--events-dir", ctx.events, "--limit", "0"])).stdout).toBe("");
});
it("continues past each corrupt log and ignores non-jsonl files", async () => {
  save("valid", fixture);
  writeFileSync(join(ctx.events, "bad.jsonl"), "{\n");
  save("version", [{ ...fixture[0], schemaVersion: 2 }]);
  save("schema", [{ ...fixture[0], taskId: 42 }]);
  save("sequence", [fixture[0], { ...fixture[1], seq: 3 }]);
  writeFileSync(join(ctx.events, "ignored.txt"), "{");
  const result = await invoke(ctx, ["list", "--events-dir", ctx.events]);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("bad  unreadable  bad JSON line 1");
  expect(result.stdout).toContain("version  unreadable  schema failure");
  expect(result.stdout).toContain("schemaVersion");
  expect(result.stdout).toContain("schema  unreadable  schema failure");
  expect(result.stdout).toContain("sequence  unreadable  non-contiguous seq");
  expect(result.stdout).toContain("add-slugify-a1b2  passed");
  expect(result.stdout).not.toContain("ignored");
  expect(result.stdout.trim().split("\n")).toHaveLength(5);
});
it("prints nothing for empty or missing directories", async () => {
  expect((await invoke(ctx, ["list", "--events-dir", ctx.events])).stdout).toBe("");
  rmSync(ctx.events, { recursive: true });
  expect(await invoke(ctx, ["list", "--events-dir", ctx.events])).toEqual({ code: 0, stdout: "", stderr: "" });
});
