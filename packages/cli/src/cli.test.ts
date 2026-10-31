import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invoke, setup } from "./test-helpers.js";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { ctx = await setup(); });
afterEach(() => rmSync(ctx.dir, { recursive: true, force: true }));

it.each([[], ["unknown"], ["delegate"], ["delegate", "a", "b"], ["list", "extra"], ["list", "--limit", "-1"], ["list", "--limit", "1.5"], ["list", "--scenario", "success"], ["delegate", "a", "--limit", "2"], ["list", "--unknown"]])("rejects invalid usage %j", async (...args) => {
  const result = await invoke(ctx, args);
  expect(result.code).toBe(3);
  expect(result.stdout).toBe("");
  expect(result.stderr).not.toBe("");
});
it("reports invalid config", async () => {
  mkdirSync(join(ctx.dir, ".dugout"));
  writeFileSync(join(ctx.dir, ".dugout/config.json"), "{");
  expect((await invoke(ctx, ["list"])).stderr).toContain("config: invalid JSON");
});
