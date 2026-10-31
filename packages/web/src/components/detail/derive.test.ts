import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Event } from "../../api.js";
import {
  attemptCardId, deriveAttempts, deriveReview, deriveSetup, deriveSteps, exitReasonText, groupIssues, REVIEW_CARD_ID,
  SETUP_CARD_ID, TOP_ID,
} from "./derive.js";

const dir = new URL("../../../../../fixtures/events/", import.meta.url).pathname;
const load = (name: string): Event[] =>
  readFileSync(`${dir}${name}.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Event);

describe("deriveAttempts", () => {
  it("builds retry and fallback attempts with usage, tools and verify", () => {
    const attempts = deriveAttempts(load("real-fallback-dogfood"));
    expect(attempts.map((a) => [a.n, a.provider, a.reason, a.exitReason])).toEqual([
      [1, "codex", "initial", "rate_limit"],
      [2, "claude", "fallback", "ok"],
      [3, "claude", "retry", "ok"],
    ]);
    const second = attempts[1];
    expect(second?.input).toBe(217500);
    expect(second?.output).toBe(8566);
    expect(second?.tools.length).toBe(13);
    expect(second?.messages.length).toBe(1);
    expect(second?.verify?.passed).toBe(false);
    expect(second?.verify?.command).toContain("pnpm lint");
    expect(attempts[0]?.verify).toBeNull();
  });

  it("returns nothing for a setup-failed log", () => {
    expect(deriveAttempts(load("setup-failed"))).toEqual([]);
  });
});

describe("deriveSetup and deriveReview", () => {
  it("reads setup.finished", () => {
    expect(deriveSetup(load("setup-failed"))).toMatchObject({ passed: false, exitCode: 1 });
    expect(deriveSetup(load("success"))).toBeNull();
  });

  it("reads and groups the review", () => {
    const review = deriveReview(load("review-issues"));
    expect(review?.provider).toBe("claude");
    const groups = groupIssues(review?.result.issues ?? []);
    expect(groups.map((g) => [g.severity, g.issues.length])).toEqual([["major", 1], ["minor", 1]]);
  });

  it("is null without review", () => {
    expect(deriveReview(load("retry"))).toBeNull();
  });
});

describe("deriveSteps", () => {
  it("covers setup, attempts, fallback, verify and links to cards", () => {
    const steps = deriveSteps(load("real-fallback-dogfood"));
    const labels = steps.map((s) => s.label);
    expect(labels).toEqual([
      "Task created", "Setup passed", "Attempt 1 started", "Attempt 1 failed", "Fallback", "Attempt 2 started",
      "Attempt 2 completed", "Verify failed", "Attempt 3 started", "Attempt 3 completed", "Verify failed", "Task failed",
    ]);
    expect(steps.find((s) => s.label === "Setup passed")?.target).toBe(SETUP_CARD_ID);
    expect(steps.find((s) => s.label === "Attempt 1 started")?.text).toBe("codex · gpt-6-astra · initial");
    expect(steps.find((s) => s.label === "Fallback")?.text).toBe("codex → claude (rate_limit)");
    expect(steps.find((s) => s.label === "Fallback")?.target).toBe(attemptCardId(2));
    expect(steps.find((s) => s.label === "Task failed")?.target).toBe(TOP_ID);
    expect(steps[3]?.tone).toBe("bad");
    expect(steps[3]?.at).toBe("+2.8s");
  });

  it("includes review steps", () => {
    const step = deriveSteps(load("review-issues")).find((s) => s.label.startsWith("Review"));
    expect(step).toMatchObject({ label: "Review changes requested", text: "2 issues", tone: "warn", target: REVIEW_CARD_ID });
  });

  it("is empty without events", () => {
    expect(deriveSteps([])).toEqual([]);
  });
});

describe("exitReasonText", () => {
  it("humanises known reasons and passes unknown ones through", () => {
    expect(exitReasonText("rate_limit")).toBe("Usage limit reached");
    expect(exitReasonText("weird")).toBe("weird");
    expect(exitReasonText(null)).toBe("No result recorded");
  });
});
