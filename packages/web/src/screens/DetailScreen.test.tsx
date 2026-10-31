// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event, TaskSummary } from "../api.js";
import { DetailScreen } from "./DetailScreen.js";

const dir = join(import.meta.dirname, "../../../../fixtures/events");
const load = (name: string): Event[] =>
  readFileSync(join(dir, `${name}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Event);

function summaryOf(events: Event[], over: Partial<TaskSummary> = {}): TaskSummary {
  const created = events[0];
  const wt = events.find((e) => e.type === "worktree.created");
  const fin = events.findLast((e) => e.type === "task.finished");
  if (created?.type !== "task.created" || fin?.type !== "task.finished") throw new Error("bad fixture");
  return {
    taskId: created.taskId, packageId: created.package.id, goal: created.package.goal, status: fin.status,
    providers: fin.providers, attempts: fin.attempts, startedAt: created.ts, durationMs: fin.durationMs,
    tokens: { input: 1000, output: 200 }, review: null,
    branch: wt?.type === "worktree.created" ? wt.branch : "", baseRef: wt?.type === "worktree.created" ? wt.baseRef : "", ...over,
  };
}

const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts", "--- a/src/a.ts", "+++ b/src/a.ts", "@@ -1,2 +1,2 @@", " keep", "-old line", "+new line", "",
].join("\n");

type Handlers = { task?: () => Response; diff?: () => Response };
function stub(h: Handlers) {
  const fn = vi.fn(async (url: string) => {
    if (url.endsWith("/diff")) return h.diff ? h.diff() : json({ error: "no" }, 404);
    return h.task ? h.task() : json({ error: "no" }, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const okTask = (name: string, over: Partial<TaskSummary> = {}) => () => {
  const events = load(name);
  return json({ summary: summaryOf(events, over), events });
};
const okDiff = (truncated = false) => () => json({ diff: DIFF, truncated, bytes: DIFF.length });

beforeEach(() => { vi.stubGlobal("scrollTo", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("DetailScreen", () => {
  it("shows loading, then header, timeline, attempt card and the diff", async () => {
    stub({ task: okTask("retry"), diff: okDiff() });
    render(<DetailScreen id="x" />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByText("Passed")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Timeline" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 }).some((h) => h.textContent?.startsWith("Attempt 1"))).toBe(true);
    expect(await screen.findByText("new line")).toBeTruthy();
    expect(screen.getByText("src/a.ts")).toBeTruthy();
  });

  it("renders fallback and retry attempts with reasons, exit text and verify output", async () => {
    stub({ task: okTask("real-fallback-dogfood"), diff: okDiff() });
    render(<DetailScreen id="x" />);
    await screen.findByText("Attempt 3 · claude");
    expect(screen.getByText("Attempt 1 · codex")).toBeTruthy();
    expect(screen.getByText("fallback")).toBeTruthy();
    expect(screen.getByText("retry")).toBeTruthy();
    expect(screen.getByText("(Usage limit reached)")).toBeTruthy();
    expect(screen.getAllByText("Verify failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Verify did not run.").length).toBe(1);
    expect(screen.getByText("Setup")).toBeTruthy();
    expect(screen.getByLabelText("Verify output, attempt 2").tagName).toBe("PRE");
  });

  it("renders review issues grouped by severity with file:line", async () => {
    stub({ task: okTask("review-issues"), diff: okDiff() });
    render(<DetailScreen id="x" />);
    const panel = (await screen.findByRole("heading", { name: "Review", level: 2 })).closest("section");
    if (!panel) throw new Error("no review panel");
    const q = within(panel);
    expect(q.getByText("changes requested")).toBeTruthy();
    expect(q.getByText("reviewed by claude · claude-sonnet-5-5")).toBeTruthy();
    expect(q.getByText("major (1)")).toBeTruthy();
    expect(q.getByText("minor (1)")).toBeTruthy();
    expect(q.getByText("packages/core/src/fetch.ts:27")).toBeTruthy();
    expect(q.getByText("Backoff has no upper cap; cap the delay.")).toBeTruthy();
  });

  it("shows no review panel for a task without review", async () => {
    stub({ task: okTask("retry"), diff: okDiff() });
    render(<DetailScreen id="x" />);
    await screen.findByText("new line");
    expect(screen.queryByRole("heading", { name: "Review", level: 2 })).toBeNull();
  });

  it("shows a setup-failed task with its own card and no attempts", async () => {
    stub({ task: okTask("setup-failed"), diff: () => json({ error: "no branch" }, 404) });
    render(<DetailScreen id="x" />);
    expect((await screen.findAllByText("Setup failed")).length).toBeGreaterThan(1);
    expect(screen.getByText(/ERR_PNPM_NO_OFFLINE_TARBALL/)).toBeTruthy();
    expect(screen.queryByText(/^Attempt 1/)).toBeNull();
    expect(await screen.findByText(/Diff not available: no branch/)).toBeTruthy();
  });

  it("degrades to a note when the diff is unreadable and keeps the rest", async () => {
    stub({ task: okTask("retry"), diff: () => json({ error: "log unreadable" }, 409) });
    render(<DetailScreen id="x" />);
    expect(await screen.findByText(/Diff not available: log unreadable/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Timeline" })).toBeTruthy();
  });

  it("does not wait for a slow diff before showing the task", async () => {
    stub({ task: okTask("retry"), diff: () => new Promise<Response>(() => {}) as unknown as Response });
    render(<DetailScreen id="x" />);
    await screen.findByRole("list", { name: "Timeline" });
    expect(screen.getByText("Loading diff…")).toBeTruthy();
  });

  it("shows a truncation notice", async () => {
    stub({ task: okTask("retry"), diff: okDiff(true) });
    render(<DetailScreen id="x" />);
    expect((await screen.findByText("Diff truncated.")).closest("p")?.getAttribute("role")).toBe("note");
  });

  it("shows only the reason for an unreadable task", async () => {
    const summary: TaskSummary = {
      taskId: "bad-log", packageId: "", goal: "", status: "unreadable", reason: "line 3 is not valid JSON", providers: [],
      attempts: 0, startedAt: "", durationMs: null, tokens: { input: 0, output: 0 }, review: null, branch: "", baseRef: "",
    };
    stub({ task: () => json({ summary, events: [] }), diff: () => json({ error: "unreadable" }, 409) });
    render(<DetailScreen id="bad-log" />);
    expect(await screen.findByText(/line 3 is not valid JSON/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Timeline" })).toBeNull();
    expect(screen.queryByText(/Diff/)).toBeNull();
  });

  it("shows the error message with retry, and recovers", async () => {
    let calls = 0;
    stub({
      task: () => (++calls === 1 ? json({ error: "boom" }, 500) : okTask("retry")()),
      diff: okDiff(),
    });
    render(<DetailScreen id="x" />);
    expect((await screen.findByRole("alert")).textContent).toContain("boom");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("list", { name: "Timeline" })).toBeTruthy();
  });

  it("shows not found for a 404", async () => {
    stub({ task: () => json({ error: "unknown task" }, 404) });
    render(<DetailScreen id="nope" />);
    expect(await screen.findByRole("heading", { name: "Task not found" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("toggles the tool-call collapsible with the keyboard-operable button", async () => {
    stub({ task: okTask("real-fallback-dogfood"), diff: okDiff() });
    render(<DetailScreen id="x" />);
    const btn = await screen.findByRole("button", { name: /^14 tool calls and messages/ });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(screen.getAllByText("scripts/scan-repo.mjs").length).toBeGreaterThan(0));
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("timeline steps are buttons that focus their card", async () => {
    stub({ task: okTask("real-fallback-dogfood"), diff: okDiff() });
    render(<DetailScreen id="x" />);
    const step = await screen.findByRole("button", { name: /Attempt 2 started/ });
    fireEvent.click(step);
    expect(document.activeElement?.id).toBe("card-attempt-2");
  });
});
