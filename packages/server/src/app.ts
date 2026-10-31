import { Hono } from "hono";
import { computeScorecard, taskStatusSchema, type Event } from "@panosu/core";
import { gitDiff } from "./diff.js";
import { isValidTaskId, readAllLogs, readLog } from "./logs.js";

export interface AppOptions {
  eventsDir: string;
  repo: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const ALLOWED_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

export function createApp({ eventsDir, repo }: AppOptions): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const host = c.req.header("host") ?? new URL(c.req.url).host;
    if (!ALLOWED_HOST.test(host)) return c.json({ error: "forbidden host" }, 403);
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/tasks", async (c) => {
    const rawLimit = c.req.query("limit");
    const limit = rawLimit === undefined ? DEFAULT_LIMIT : /^\d+$/.test(rawLimit) ? Number(rawLimit) : 0;
    if (limit < 1 || limit > MAX_LIMIT) return c.json({ error: `limit must be an integer from 1 to ${MAX_LIMIT}` }, 400);
    const rawStatus = c.req.query("status");
    const status = rawStatus === undefined ? undefined : taskStatusSchema.safeParse(rawStatus);
    if (status && !status.success) return c.json({ error: "invalid status" }, 400);
    const summaries = (await readAllLogs(eventsDir)).map((entry) => entry.summary)
      .filter((summary) => !status || summary.status === status.data);
    summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.taskId.localeCompare(b.taskId));
    return c.json({ tasks: summaries.slice(0, limit) });
  });

  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    if (!isValidTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const entry = await readLog(eventsDir, id);
    if (!entry) return c.json({ error: "task not found" }, 404);
    return c.json({ summary: entry.summary, events: entry.events });
  });

  app.get("/api/tasks/:id/diff", async (c) => {
    const id = c.req.param("id");
    if (!isValidTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const entry = await readLog(eventsDir, id);
    if (!entry) return c.json({ error: "task not found" }, 404);
    if (entry.summary.status === "unreadable") return c.json({ error: "task log is unreadable" }, 409);
    const result = await gitDiff(repo, entry.summary.baseRef, entry.summary.branch);
    if (!result) return c.json({ error: "no diff available for this task" }, 404);
    return c.json(result);
  });

  app.get("/api/scorecard", async (c) => {
    const excluded = { interrupted: 0, unreadable: 0 };
    const logs: Event[][] = [];
    for (const { summary, events } of await readAllLogs(eventsDir)) {
      if (summary.status === "unreadable") excluded.unreadable += 1;
      else if (summary.status === "interrupted") excluded.interrupted += 1;
      else logs.push(events);
    }
    return c.json(computeScorecard({ logs, excluded }));
  });

  app.notFound((c) => c.json({ error: "not found" }, 404));
  app.onError((_error, c) => c.json({ error: "internal error" }, 500));

  return app;
}
