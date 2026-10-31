// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement as h } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import type { TaskSummary } from "./api.js";

function task(over: Partial<TaskSummary>): TaskSummary {
  return {
    taskId: "t-1", packageId: "p", goal: "Add the thing", status: "passed", providers: ["codex"], attempts: 1,
    startedAt: "2026-10-31T10:00:00.000Z", durationMs: 65000, tokens: { input: 8000, output: 4000 },
    review: null, branch: "b", baseRef: "main", ...over,
  };
}

const TASKS: TaskSummary[] = [
  task({ taskId: "t-pass", goal: "Passing goal" }),
  task({ taskId: "t-fail", goal: "Failing goal", status: "failed", providers: ["codex", "claude"], attempts: 3 }),
  task({ taskId: "t-int", goal: "Interrupted goal", status: "interrupted", durationMs: null, reason: "log has no task.finished" }),
  task({ taskId: "bad-log", goal: "", status: "unreadable", reason: "line 3 is not valid JSON", providers: [], attempts: 0 }),
];

function stubTasks(tasks: TaskSummary[]) {
  const fn = vi.fn(async () => new Response(JSON.stringify({ tasks }), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  window.location.hash = "";
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ListScreen", () => {
  it("renders summaries from the API", async () => {
    stubTasks(TASKS);
    render(h(App));
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByText("Passing goal")).toBeTruthy();
    expect(screen.getByText("Failing goal")).toBeTruthy();
    expect(screen.getByText("log has no task.finished")).toBeTruthy();
    expect(screen.getByText("line 3 is not valid JSON")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Scorecard" })).toBeTruthy();
  });

  it("filters by status and provider", async () => {
    stubTasks(TASKS);
    render(h(App));
    await screen.findByText("Passing goal");
    fireEvent.click(screen.getByRole("button", { name: "Failed 1" }));
    expect(screen.queryByText("Passing goal")).toBeNull();
    expect(screen.getByText("Failing goal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.click(screen.getByRole("button", { name: "claude" }));
    expect(screen.queryByText("Passing goal")).toBeNull();
    expect(screen.getByText("Failing goal")).toBeTruthy();
  });

  it("shows the empty state with pnpm demo", async () => {
    stubTasks([]);
    render(h(App));
    expect(await screen.findByText("No tasks yet.")).toBeTruthy();
    expect(screen.getByText("pnpm demo")).toBeTruthy();
  });

  it("shows an error with retry", async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "boom" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tasks: TASKS }), { status: 200 }));
    vi.stubGlobal("fetch", fn);
    render(h(App));
    expect((await screen.findByRole("alert")).textContent).toContain("boom");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Passing goal")).toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("moves with j/k and opens with Enter", async () => {
    stubTasks(TASKS);
    render(h(App));
    await screen.findByText("Passing goal");
    fireEvent.keyDown(document.body, { key: "j" });
    const links = screen.getAllByRole("link").filter((a) => a.hasAttribute("data-row"));
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[1]);
    fireEvent.keyDown(document.body, { key: "k" });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(window.location.hash).toBe("");
    links[0]?.blur();
    fireEvent.keyDown(document.body, { key: "Enter" });
    await waitFor(() => expect(window.location.hash).toBe("#/tasks/t-pass"));
    await screen.findByText("Esc");
  });

  it("Enter on a focused control or nav link is left alone; Enter on body opens the first card", async () => {
    stubTasks(TASKS);
    render(h(App));
    await screen.findByText("Passing goal");
    const filter = screen.getByRole("button", { name: "Failed 1" });
    filter.focus();
    const pressed = fireEvent.keyDown(filter, { key: "Enter" });
    expect(pressed).toBe(true);
    expect(window.location.hash).toBe("");
    fireEvent.click(filter);
    expect(filter.getAttribute("aria-pressed")).toBe("true");
    const nav = screen.getByRole("link", { name: "Scorecard" });
    nav.focus();
    expect(fireEvent.keyDown(nav, { key: "Enter" })).toBe(true);
    expect(window.location.hash).toBe("");
    (document.activeElement as HTMLElement | null)?.blur();
    expect(fireEvent.keyDown(document.body, { key: "Enter" })).toBe(false);
    await waitFor(() => expect(window.location.hash).toBe("#/tasks/t-fail"));
  });

  it("Escape goes back to the list and unknown hashes show not-found", async () => {
    stubTasks(TASKS);
    window.location.hash = "#/nowhere";
    render(h(App));
    expect(screen.getByText("Page not found")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(window.location.hash).toBe("#/"));
    expect(await screen.findByText("Passing goal")).toBeTruthy();
  });

  it("renders the detail screen for a task route", async () => {
    stubTasks([]);
    window.location.hash = "#/tasks/abc";
    render(h(App));
    expect(screen.getByRole("status").textContent).toContain("Loading task");
    await act(async () => {});
  });
});

describe("theme toggle", () => {
  it("toggles and stores the choice", async () => {
    stubTasks([]);
    render(h(App));
    const btn = screen.getByRole("button", { name: /theme/ });
    fireEvent.click(btn);
    const first = document.documentElement.dataset.theme;
    expect(first === "light" || first === "dark").toBe(true);
    expect(window.localStorage.getItem("panosu-theme")).toBe(first);
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).not.toBe(first);
    await screen.findByText("No tasks yet.");
  });

  it("works when localStorage throws", async () => {
    stubTasks([]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(h(App));
    fireEvent.click(screen.getByRole("button", { name: /theme/ }));
    expect(["light", "dark"]).toContain(document.documentElement.dataset.theme);
    await screen.findByText("No tasks yet.");
  });
});
