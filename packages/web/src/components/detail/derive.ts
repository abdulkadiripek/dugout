import type { Event } from "../../api.js";
import { formatDuration } from "../../formatters.js";

type Of<T extends Event["type"]> = Extract<Event, { type: T }>;

export type Tone = "ok" | "bad" | "warn" | "info" | "mute";

export type Step = { key: number; tone: Tone; at: string; label: string; text: string; target: string };

export type VerifyInfo = {
  command: string;
  passed: boolean | null;
  exitCode: number | null;
  durationMs: number | null;
  outputTail: string;
};

export type AttemptInfo = {
  n: number;
  provider: string;
  model: string;
  reason: string;
  status: "completed" | "failed" | null;
  exitReason: string | null;
  durationMs: number | null;
  input: number;
  output: number;
  verify: VerifyInfo | null;
  tools: { name: string; summary: string }[];
  messages: string[];
};

export type SetupInfo = { passed: boolean; exitCode: number; durationMs: number; outputTail: string };

export type ReviewInfo = Of<"review.finished">;
export type ReviewIssue = ReviewInfo["result"]["issues"][number];

export const TOP_ID = "detail-top";
export const attemptCardId = (n: number) => `card-attempt-${n}`;
export const SETUP_CARD_ID = "card-setup";
export const REVIEW_CARD_ID = "card-review";

export const SEVERITIES = ["blocker", "major", "minor", "nit"] as const;

const EXIT_TEXT: Record<string, string> = {
  ok: "Finished normally",
  rate_limit: "Usage limit reached",
  auth: "Not logged in or session expired",
  timeout: "Timed out",
  crash: "Provider crashed",
  invalid_output: "Output could not be parsed",
};

export function exitReasonText(reason: string | null): string {
  if (reason === null) return "No result recorded";
  return EXIT_TEXT[reason] ?? reason;
}

function offset(ts: string, start: string): string {
  const diff = Date.parse(ts) - Date.parse(start);
  if (!Number.isFinite(diff) || diff < 0) return "+0s";
  return `+${formatDuration(diff)}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function deriveAttempts(events: readonly Event[]): AttemptInfo[] {
  const list: AttemptInfo[] = [];
  const byN = new Map<number, AttemptInfo>();
  for (const e of events) {
    if (e.type === "attempt.started") {
      const a: AttemptInfo = {
        n: e.attempt, provider: e.provider, model: e.model, reason: e.reason, status: null, exitReason: null,
        durationMs: null, input: 0, output: 0, verify: null, tools: [], messages: [],
      };
      byN.set(e.attempt, a);
      list.push(a);
      continue;
    }
    if (!("attempt" in e)) continue;
    const a = byN.get(e.attempt);
    if (!a) continue;
    if (e.type === "attempt.finished") {
      a.status = e.status;
      a.exitReason = e.exitReason;
      a.durationMs = e.durationMs;
    } else if (e.type === "provider.usage") {
      a.input += e.inputTokens ?? 0;
      a.output += e.outputTokens ?? 0;
    } else if (e.type === "verify.started") {
      a.verify = { command: e.command, passed: null, exitCode: null, durationMs: null, outputTail: "" };
    } else if (e.type === "verify.finished") {
      a.verify = {
        command: a.verify?.command ?? "", passed: e.passed, exitCode: e.exitCode,
        durationMs: e.durationMs, outputTail: e.outputTail ?? "",
      };
    } else if (e.type === "provider.tool") {
      a.tools.push({ name: e.name, summary: e.summary });
    } else if (e.type === "provider.message") {
      a.messages.push(e.text);
    }
  }
  return list;
}

export function deriveSetup(events: readonly Event[]): SetupInfo | null {
  const e = events.find((x): x is Of<"setup.finished"> => x.type === "setup.finished");
  if (!e) return null;
  return { passed: e.passed, exitCode: e.exitCode, durationMs: e.durationMs, outputTail: e.outputTail ?? "" };
}

export function deriveReview(events: readonly Event[]): ReviewInfo | null {
  return events.findLast((x): x is ReviewInfo => x.type === "review.finished") ?? null;
}

export function groupIssues(issues: readonly ReviewIssue[]): { severity: (typeof SEVERITIES)[number]; issues: ReviewIssue[] }[] {
  return SEVERITIES.map((severity) => ({ severity, issues: issues.filter((i) => i.severity === severity) }))
    .filter((g) => g.issues.length > 0);
}

export function deriveSteps(events: readonly Event[]): Step[] {
  const first = events[0];
  if (!first) return [];
  const start = first.ts;
  const steps: Step[] = [];
  const pendingFallback: Step[] = [];
  for (const e of events) {
    const at = offset(e.ts, start);
    switch (e.type) {
      case "task.created":
        steps.push({ key: e.seq, tone: "info", at, label: "Task created", text: e.package.goal, target: TOP_ID });
        break;
      case "setup.finished":
        steps.push({
          key: e.seq, tone: e.passed ? "ok" : "bad", at, label: `Setup ${e.passed ? "passed" : "failed"}`,
          text: `exit ${e.exitCode} in ${formatDuration(e.durationMs)}`, target: SETUP_CARD_ID,
        });
        break;
      case "attempt.started": {
        for (const f of pendingFallback.splice(0)) f.target = attemptCardId(e.attempt);
        steps.push({
          key: e.seq, tone: "info", at, label: `Attempt ${e.attempt} started`,
          text: `${e.provider} · ${e.model} · ${e.reason}`, target: attemptCardId(e.attempt),
        });
        break;
      }
      case "attempt.finished":
        steps.push({
          key: e.seq, tone: e.status === "completed" ? "ok" : "bad", at, label: `Attempt ${e.attempt} ${e.status}`,
          text: `${exitReasonText(e.exitReason)} · ${formatDuration(e.durationMs)}`, target: attemptCardId(e.attempt),
        });
        break;
      case "fallback.triggered": {
        const s: Step = {
          key: e.seq, tone: "warn", at, label: "Fallback", text: `${e.from} → ${e.to} (${e.reason})`, target: TOP_ID,
        };
        pendingFallback.push(s);
        steps.push(s);
        break;
      }
      case "verify.finished":
        steps.push({
          key: e.seq, tone: e.passed ? "ok" : "bad", at, label: `Verify ${e.passed ? "passed" : "failed"}`,
          text: `exit ${e.exitCode} in ${formatDuration(e.durationMs)}`, target: attemptCardId(e.attempt),
        });
        break;
      case "review.finished":
        steps.push({
          key: e.seq, tone: e.result.verdict === "approve" ? "ok" : "warn", at,
          label: `Review ${e.result.verdict.replace("_", " ")}`, text: plural(e.result.issues.length, "issue"),
          target: REVIEW_CARD_ID,
        });
        break;
      case "task.finished":
        steps.push({
          key: e.seq, tone: e.status === "passed" ? "ok" : e.status === "failed" ? "bad" : "warn", at,
          label: `Task ${e.status.replace("_", " ")}`,
          text: `${plural(e.attempts, "attempt")} · ${e.diffStat.files} files +${e.diffStat.additions} −${e.diffStat.deletions} · ${formatDuration(e.durationMs)}`,
          target: TOP_ID,
        });
        break;
      default:
        break;
    }
  }
  for (const f of pendingFallback) f.target = TOP_ID;
  return steps;
}

export const TONE_ICON: Record<Tone, string> = { ok: "✓", bad: "✕", warn: "!", info: "●", mute: "·" };
