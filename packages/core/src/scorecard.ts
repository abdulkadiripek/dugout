import type { Event } from "./events.js";
import type { ImplementerRow, ReviewerRow, Scorecard } from "./api-schemas.js";

export type ScorecardInput = {
  logs: readonly (readonly Event[])[];
  excluded: { interrupted: number; unreadable: number };
};

type Attempt = Extract<Event, { type: "attempt.started" }>;

const round = (value: number) => Math.round(value * 10000) / 10000;
const keyOf = (item: { provider: string; model: string }) => `${item.provider}\n${item.model}`;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function implementerRows(logs: ScorecardInput["logs"]): ImplementerRow[] {
  const rows = new Map<string, {
    provider: Attempt["provider"]; model: string; tasks: number; passed: number; firstTry: number;
    retries: number; durationMs: number; inputTokens: number; outputTokens: number;
  }>();
  for (const events of logs) {
    const status = events.findLast((event) => event.type === "task.finished")?.status;
    const attempts = events.filter((event) => event.type === "attempt.started");
    const last = attempts.at(-1);
    const byAttempt = new Map(attempts.map((event) => [event.attempt, keyOf(event)]));
    const groups = new Map<string, Attempt[]>();
    for (const attempt of attempts) groups.set(keyOf(attempt), [...(groups.get(keyOf(attempt)) ?? []), attempt]);
    for (const mine of groups.values()) {
      const first = mine[0];
      if (!first) continue;
      const key = keyOf(first);
      const row = rows.get(key) ?? {
        provider: first.provider, model: first.model, tasks: 0, passed: 0, firstTry: 0,
        retries: 0, durationMs: 0, inputTokens: 0, outputTokens: 0,
      };
      row.tasks += 1;
      if (status === "passed" && last && keyOf(last) === key) row.passed += 1;
      if (status === "passed" && attempts.length === 1 && mine.length === 1) row.firstTry += 1;
      row.retries += mine.filter((event) => event.reason === "retry").length;
      for (const event of events) {
        if (!("attempt" in event) || byAttempt.get(event.attempt) !== key) continue;
        if (event.type === "attempt.finished") row.durationMs += event.durationMs;
        if (event.type === "provider.usage") {
          row.inputTokens += event.inputTokens ?? 0;
          row.outputTokens += event.outputTokens ?? 0;
        }
      }
      rows.set(key, row);
    }
  }
  return [...rows.values()].map((row) => ({
    provider: row.provider, model: row.model, tasks: row.tasks, passed: row.passed,
    firstTryPassRate: round(row.firstTry / row.tasks),
    meanRetries: round(row.retries / row.tasks),
    meanDurationMs: round(row.durationMs / row.tasks),
    inputTokens: row.inputTokens, outputTokens: row.outputTokens,
  })).sort((a, b) => b.tasks - a.tasks || compare(a.provider, b.provider) || compare(a.model, b.model));
}

function reviewerRows(logs: ScorecardInput["logs"]): ReviewerRow[] {
  const rows = new Map<string, ReviewerRow>();
  for (const events of logs) {
    for (const event of events) {
      if (event.type !== "review.finished") continue;
      const key = keyOf(event);
      const row = rows.get(key) ?? {
        provider: event.provider, model: event.model, reviews: 0, blocker: 0, major: 0, minor: 0, nit: 0,
      };
      row.reviews += 1;
      for (const issue of event.result.issues) row[issue.severity] += 1;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) =>
    b.reviews - a.reviews || compare(a.provider, b.provider) || compare(a.model, b.model));
}

export function computeScorecard(input: ScorecardInput): Scorecard {
  return {
    implementers: implementerRows(input.logs),
    reviewers: reviewerRows(input.logs),
    excluded: { ...input.excluded },
  };
}
