import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeScorecard, eventSchema, parseLog, scorecardSchema, taskSummarySchema, type Event,
} from "@dugout/core";
import { createApp } from "./app.js";
import { commitOnBranch, fixture, setup, writeLog } from "./test-helpers.js";

type Body = Record<string, unknown>;
const tasksSchema = {
  parse: (body: unknown) => ({ tasks: taskSummarySchema.array().parse((body as Body)["tasks"]) }),
};
const detailSchema = {
  parse: (body: unknown) => ({
    summary: taskSummarySchema.parse((body as Body)["summary"]),
    events: eventSchema.array().parse((body as Body)["events"]),
  }),
};
const diffSchema = {
  parse: (body: unknown) => {
    const { diff, truncated, bytes } = body as { diff: string; truncated: boolean; bytes: number };
    expect([typeof diff, typeof truncated, typeof bytes]).toEqual(["string", "boolean", "number"]);
    return { diff, truncated, bytes };
  },
};

async function get(app: ReturnType<typeof createApp>, path: string) {
  const response = await app.request(path);
  return { status: response.status, body: (await response.json()) as unknown };
}

describe("health", () => {
  it("answers ok", async () => {
    const ctx = await setup();
    expect(await get(createApp({ eventsDir: ctx.events, repo: ctx.repo }), "/api/health")).toEqual({ status: 200, body: { ok: true } });
  });
});

describe("GET /api/tasks", () => {
  it("returns an empty list for a missing or empty events dir", async () => {
    const ctx = await setup();
    const missing = createApp({ eventsDir: join(ctx.dir, "nope"), repo: ctx.repo });
    expect(await get(missing, "/api/tasks")).toEqual({ status: 200, body: { tasks: [] } });
    const empty = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    expect(await get(empty, "/api/tasks")).toEqual({ status: 200, body: { tasks: [] } });
  });

  it("sorts newest first, ignores non-jsonl files, supports limit and status", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    writeLog(ctx.events, "success", fixture("success"));
    writeLog(ctx.events, "failed", fixture("failed"));
    writeLog(ctx.events, "retry", fixture("retry"));
    writeFileSync(join(ctx.events, "notes.txt"), "x");
    writeFileSync(join(ctx.events, ".hidden.jsonl"), fixture("success"));
    const all = tasksSchema.parse((await get(app, "/api/tasks")).body).tasks;
    expect(all.map((task) => task.taskId).sort()).toEqual(["failed", "retry", "success"]);
    const times = all.map((task) => task.startedAt);
    expect(times).toEqual([...times].sort().reverse());
    const limited = tasksSchema.parse((await get(app, "/api/tasks?limit=2")).body).tasks;
    expect(limited.map((task) => task.taskId)).toEqual(all.slice(0, 2).map((task) => task.taskId));
    const failed = tasksSchema.parse((await get(app, "/api/tasks?status=failed")).body).tasks;
    expect(failed.map((task) => task.taskId)).toEqual(["failed"]);
  });

  it("rejects an invalid limit or status", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    for (const query of ["limit=0", "limit=abc", "limit=-1", "limit=501", "limit=1.5", "status=nope"]) {
      expect((await get(app, `/api/tasks?${query}`)).status, query).toBe(400);
    }
    expect((await get(app, "/api/tasks?limit=500")).status).toBe(200);
  });

  it("lists unreadable and interrupted logs without breaking", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    writeLog(ctx.events, "bad", "not json\n");
    writeLog(ctx.events, "empty", "");
    const lines = fixture("success").trimEnd().split("\n");
    writeLog(ctx.events, "cut", lines.slice(0, -1).join("\n") + "\n");
    const tasks = tasksSchema.parse((await get(app, "/api/tasks")).body).tasks;
    const byId = Object.fromEntries(tasks.map((task) => [task.taskId, task]));
    expect(byId["bad"]?.status).toBe("unreadable");
    expect(byId["bad"]?.reason).toContain("bad JSON");
    expect(byId["empty"]?.status).toBe("unreadable");
    expect(byId["cut"]?.status).toBe("interrupted");
    expect(byId["cut"]?.durationMs).toBeNull();
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns summary and events, and events [] for unreadable", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    writeLog(ctx.events, "success", fixture("success"));
    writeLog(ctx.events, "bad", "{\n");
    const ok = detailSchema.parse((await get(app, "/api/tasks/success")).body);
    expect(ok.summary.status).toBe("passed");
    expect(ok.events.length).toBeGreaterThan(3);
    const bad = detailSchema.parse((await get(app, "/api/tasks/bad")).body);
    expect(bad.summary.status).toBe("unreadable");
    expect(bad.events).toEqual([]);
  });

  it("gives 404 for an unknown id", async () => {
    const ctx = await setup();
    expect((await get(createApp({ eventsDir: ctx.events, repo: ctx.repo }), "/api/tasks/unknown")).status).toBe(404);
  });

  it("gives 400 for malformed ids", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    writeLog(ctx.events, "success", fixture("success"));
    for (const id of ["a%2Fb", "a%5Cb", ".hidden", "-x", "_x", "a.b", "a%00b", "a".repeat(129), "%2E%2E%2Fx"]) {
      expect((await get(app, `/api/tasks/${id}`)).status, id).toBe(400);
      expect((await get(app, `/api/tasks/${id}/diff`)).status, id).toBe(400);
    }
    expect((await get(app, `/api/tasks/${"a".repeat(128)}`)).status).toBe(404);
  });

  it("never reads outside the events dir", async () => {
    const ctx = await setup();
    const events = join(ctx.dir, "events-sub");
    mkdirSync(events);
    writeFileSync(join(ctx.dir, "outside.jsonl"), fixture("success"));
    symlinkSync(join(ctx.dir, "outside.jsonl"), join(events, "linked.jsonl"));
    const app = createApp({ eventsDir: events, repo: ctx.repo });
    expect((await get(app, "/api/tasks/outside")).status).toBe(404);
    expect((await get(app, "/api/tasks/..%2Foutside")).status).toBe(400);
    expect((await get(app, "/api/tasks/linked")).status).toBe(404);
    expect(tasksSchema.parse((await get(app, "/api/tasks")).body).tasks).toEqual([]);
  });
});

describe("GET /api/tasks/:id/diff", () => {
  async function withBranch(mutate: (text: string) => string = (text) => text) {
    const ctx = await setup();
    await commitOnBranch(ctx.repo, "dugout/add-slugify-a1b2", "new.txt", "hello\n");
    writeLog(ctx.events, "good", mutate(fixture("success")));
    return { ctx, app: createApp({ eventsDir: ctx.events, repo: ctx.repo }) };
  }

  it("returns git diff base...branch", async () => {
    const { app } = await withBranch();
    const result = diffSchema.parse((await get(app, "/api/tasks/good/diff")).body);
    expect(result.truncated).toBe(false);
    expect(result.diff).toContain("+++ b/new.txt");
    expect(result.diff).toContain("+hello");
    expect(result.bytes).toBe(Buffer.byteLength(result.diff));
  });

  it("truncates on a line boundary with a marker", async () => {
    const ctx = await setup();
    const content = Array.from({ length: 30000 }, (_, i) => `line ${i}`).join("\n") + "\n";
    await commitOnBranch(ctx.repo, "dugout/add-slugify-a1b2", "big.txt", content);
    writeLog(ctx.events, "good", fixture("success"));
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    const result = diffSchema.parse((await get(app, "/api/tasks/good/diff")).body);
    expect(result.truncated).toBe(true);
    expect(result.bytes).toBeGreaterThan(200000);
    const lines = result.diff.split("\n");
    const marker = lines.at(-1) ?? "";
    const omitted = Number(/^\[diff truncated: (\d+) bytes omitted\]$/.exec(marker)?.[1]);
    const kept = Buffer.byteLength(lines.slice(0, -1).join("\n") + "\n");
    expect(kept).toBeLessThanOrEqual(200000);
    expect(kept + omitted).toBe(result.bytes);
    expect(lines.at(-2)).toMatch(/^\+line \d+$/);
  });

  it("gives 404 when the branch is missing or refs are invalid", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    writeLog(ctx.events, "nobranch", fixture("success"));
    expect((await get(app, "/api/tasks/nobranch/diff")).status).toBe(404);
    const refs = ["--output=evil", "-x", "a..b", "a b", "x;y", "", "a@{1}"];
    for (const [index, ref] of refs.entries()) {
      writeLog(ctx.events, `badbranch${index}`, fixture("success").replace("dugout/add-slugify-a1b2", ref));
      writeLog(ctx.events, `badbase${index}`, fixture("success").replace('"baseRef":"main"', `"baseRef":"${ref}"`));
      expect((await get(app, `/api/tasks/badbranch${index}/diff`)).status, ref).toBe(404);
      expect((await get(app, `/api/tasks/badbase${index}/diff`)).status, ref).toBe(404);
    }
  });

  it("gives 404 for unknown id and 409 for an unreadable log", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    writeLog(ctx.events, "bad", "nope\n");
    expect((await get(app, "/api/tasks/missing/diff")).status).toBe(404);
    expect((await get(app, "/api/tasks/bad/diff")).status).toBe(409);
  });
});

describe("GET /api/scorecard", () => {
  it("equals computeScorecard over readable finished logs and counts exclusions", async () => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    const names = ["success", "retry", "review-issues"];
    const logs: Event[][] = [];
    for (const name of names) {
      writeLog(ctx.events, name, fixture(name));
      const parsed = parseLog(fixture(name).trimEnd().split("\n"));
      if (parsed.ok) logs.push(parsed.events);
    }
    writeLog(ctx.events, "bad", "nope\n");
    writeLog(ctx.events, "cut", fixture("failed").trimEnd().split("\n").slice(0, -1).join("\n") + "\n");
    const result = (await get(app, "/api/scorecard"));
    expect(result.status).toBe(200);
    const expected = computeScorecard({ logs, excluded: { interrupted: 1, unreadable: 1 } });
    expect(scorecardSchema.parse(result.body)).toEqual(expected);
    expect(expected.implementers.length).toBeGreaterThan(0);
  });
});

describe("Host check", () => {
  const status = async (host?: string) => {
    const ctx = await setup();
    const app = createApp({ eventsDir: ctx.events, repo: ctx.repo });
    const response = await app.request("/api/health", host === undefined ? {} : { headers: { host } });
    return { status: response.status, body: (await response.json()) as unknown };
  };

  it.each(["127.0.0.1", "127.0.0.1:5173", "localhost", "LOCALHOST:8080", "[::1]", "[::1]:3000"])("allows %s", async (host) => {
    expect((await status(host)).status).toBe(200);
  });

  it.each(["evil.example", "127.0.0.1.evil.example", "localhost.evil.example", "evil.example:80", ""])(
    "rejects %j", async (host) => {
      expect(await status(host)).toEqual({ status: 403, body: { error: "forbidden host" } });
    },
  );
});
