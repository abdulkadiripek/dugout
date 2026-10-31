// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement as h } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { TaskSummary } from "../api.js";
import { TaskCard } from "./TaskCard.js";

afterEach(cleanup);

function task(attempts: number, tokens = { input: 100, output: 50 }): TaskSummary {
  return {
    taskId: "t1",
    goal: "goal",
    status: attempts === 0 ? "failed" : "passed",
    attempts,
    tokens,
    providers: [],
    durationMs: 1000,
    startedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as TaskSummary;
}

function dotsText(t: TaskSummary): string {
  const { container } = render(h(TaskCard, { task: t }));
  return Array.from(container.querySelectorAll(".dots > .muted"), (n) => n.textContent).join("|");
}

describe("TaskCard attempts", () => {
  it("shows a single line for 0 attempts and no empty bar", () => {
    const t = task(0, { input: 0, output: 0 });
    const { container } = render(h(TaskCard, { task: t }));
    expect(container.querySelector(".dots")?.textContent).toBe("no attempts");
    expect(container.querySelector(".bar")).toBeNull();
  });

  it("keeps counts for 1 and 3 attempts", () => {
    expect(dotsText(task(1))).toBe("1 attempt");
    cleanup();
    expect(dotsText(task(3))).toBe("3 attempts");
  });
});
