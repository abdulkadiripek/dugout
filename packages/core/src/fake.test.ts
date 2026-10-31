import { expect, it } from "vitest";
import {
  createFakeScenario, eventSchema, reviewResultSchema, scenarios,
  type AttemptInput, type ProviderAdapter, type ProviderEvent,
} from "./index.js";

function input(attempt = 1): AttemptInput {
  return {
    taskId: "fake-task", attempt, cwd: ".", prompt: "Do the task.",
    signal: new AbortController().signal,
  };
}

async function run(adapter: ProviderAdapter | undefined, attemptInput = input()) {
  if (!adapter) throw new Error("Expected an adapter");
  const events: ProviderEvent[] = [];
  const generator = adapter.run(attemptInput);
  let next = await generator.next();
  while (!next.done) {
    events.push(next.value);
    next = await generator.next();
  }
  return { events, result: next.value };
}

it.each(["success", "fail", "rate_limit", "crash"] as const)("runs built-in %s", async (name) => {
  const scenario = createFakeScenario({ fake: scenarios[name]() });
  expect(Object.keys(scenario.adapters)).toEqual(["fake"]);
  expect(scenario.adapters.fake?.name).toBe("fake");
  const { events, result } = await run(scenario.adapters.fake, input(3));
  const ok = name === "success" || name === "fail";
  expect(result).toEqual({ exitReason: ok ? "ok" : name, durationMs: 0 });
  expect(events.map((event) => event.type)).toEqual(ok ? ["provider.message", "provider.usage"] : []);
  for (const event of events) {
    expect(event.attempt).toBe(3);
    for (const key of ["schemaVersion", "seq", "ts", "taskId"]) expect(event).not.toHaveProperty(key);
    expect(eventSchema.safeParse({
      schemaVersion: 1, seq: 0, ts: "2026-01-01T00:00:00Z", taskId: "fake-task", ...event,
    }).success).toBe(true);
  }
  if (ok) {
    const verification = await scenario.runVerify(".", "unused");
    expect(verification).toMatchObject({ passed: name === "success", exitCode: name === "success" ? 0 : 1, durationMs: 0 });
    if (name === "fail") expect(verification.outputTail.length).toBeGreaterThan(0);
  }
  await expect(scenario.runVerify(".", "unused")).rejects.toThrow(/verification/);
  await expect(run(scenario.adapters.fake)).rejects.toThrow(/fake/);
});

it("consumes per-provider outcomes and verifies in consumption order", async () => {
  const scenario = createFakeScenario({
    codex: [{ exit: "rate_limit", verify: "fail" }, { exit: "ok", durationMs: 42 }],
    claude: [{ exit: "ok", verify: "fail" }, { exit: "ok", verify: "pass" }],
    fake: [],
  });
  expect(Object.keys(scenario.adapters)).toEqual(["codex", "claude", "fake"]);
  for (const [name, adapter] of Object.entries(scenario.adapters)) expect(adapter.name).toBe(name);
  await expect(scenario.runVerify(".", "unused")).rejects.toThrow(/verification/);
  expect((await run(scenario.adapters.codex)).result.exitReason).toBe("rate_limit");
  await expect(scenario.runVerify(".", "unused")).rejects.toThrow(/verification/);
  await run(scenario.adapters.claude);
  expect((await run(scenario.adapters.codex)).result).toEqual({ exitReason: "ok", durationMs: 42 });
  await run(scenario.adapters.claude);
  for (const passed of [false, true, true]) {
    expect((await scenario.runVerify(".", "unused")).passed).toBe(passed);
  }
  await expect(scenario.runVerify(".", "unused")).rejects.toThrow(/verification/);
  for (const name of ["codex", "claude", "fake"] as const) {
    await expect(run(scenario.adapters[name])).rejects.toThrow(name);
  }
});

it.each(["auth", "timeout", "invalid_output"] as const)("returns scripted %s without events or verification", async (exit) => {
  const scenario = createFakeScenario({ fake: [{ exit, verify: "fail", durationMs: 7 }] });
  expect(await run(scenario.adapters.fake)).toEqual({ events: [], result: { exitReason: exit, durationMs: 7 } });
  await expect(scenario.runVerify(".", "unused")).rejects.toThrow(/verification/);
});

it.each([undefined, "approve", "changes_requested"] as const)("returns valid review %s", async (review) => {
  const { adapters } = createFakeScenario({ fake: [], ...(review ? { review } : {}) });
  const result = await adapters.fake?.review({ ...input(), baseRef: "main" });
  expect(reviewResultSchema.parse(result)).toEqual(result);
  expect(result?.verdict).toBe(review ?? "approve");
  expect(result?.issues).toHaveLength(review === "changes_requested" ? 1 : 0);
  if (review === "changes_requested") expect(result?.issues[0]?.severity).toBe("major");
});

it("does not consume an outcome or enqueue verification when already aborted", async () => {
  const scenario = createFakeScenario({ fake: scenarios.success() });
  const controller = new AbortController();
  controller.abort();
  const aborted = { ...input(), signal: controller.signal };
  expect(await run(scenario.adapters.fake, aborted)).toEqual({
    events: [], result: { exitReason: "timeout", durationMs: 0 },
  });
  await expect(scenario.runVerify(".", "unused")).rejects.toThrow(/verification/);
  expect((await run(scenario.adapters.fake)).result.exitReason).toBe("ok");
  expect((await scenario.runVerify(".", "unused")).passed).toBe(true);
  expect((await run(scenario.adapters.fake, aborted)).result.exitReason).toBe("timeout");
});

it("keeps scenarios independent and does not mutate the supplied outcomes", async () => {
  const outcomes = scenarios.success();
  const first = createFakeScenario({ fake: outcomes });
  const second = createFakeScenario({ fake: outcomes });
  expect(await run(first.adapters.fake)).toEqual(await run(second.adapters.fake));
  expect(outcomes).toEqual([{ exit: "ok", verify: "pass" }]);
  expect(scenarios.success()).not.toBe(scenarios.success());
  expect(await first.runVerify(".", "unused")).toEqual(await second.runVerify(".", "unused"));
});
