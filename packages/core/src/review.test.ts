import { readFileSync } from "node:fs";
import { z } from "zod";
import { expect, it } from "vitest";
import { normalizeReview, reviewResultSchema } from "./index.js";

it.each(["blocker", "major", "minor", "nit"] as const)("enforces verdict for %s", (severity) => {
  const verdict = severity === "blocker" || severity === "major" ? "changes_requested" : "approve";
  const result = {
    verdict, summary: "Review complete.",
    issues: [{ file: "src/example.ts", severity, message: "An issue." }],
  };
  expect(reviewResultSchema.parse(result)).toEqual(result);
  expect(() => reviewResultSchema.parse({
    ...result, verdict: verdict === "approve" ? "changes_requested" : "approve",
  })).toThrow(/verdict/);
});

it("requires approval for no issues", () => {
  expect(reviewResultSchema.safeParse({ verdict: "approve", summary: "Good.", issues: [] }).success).toBe(true);
  expect(reviewResultSchema.safeParse({ verdict: "changes_requested", summary: "Good.", issues: [] }).success).toBe(false);
});

it("handles mixed severities and optional line numbers", () => {
  expect(reviewResultSchema.safeParse({
    verdict: "changes_requested", summary: "Fix the major issue.",
    issues: [
      { file: "src/a.ts", line: 12, severity: "minor", message: "Small issue." },
      { file: "src/b.ts", severity: "major", message: "Large issue." },
    ],
  }).success).toBe(true);
});

it.each([
  { file: "/tmp/file" }, { file: "../file" }, { file: "src\\file" },
  { line: 0 }, { line: 1.5 }, { severity: "critical" }, { message: undefined },
])("rejects invalid issue fields %j", (invalid) => {
  expect(reviewResultSchema.safeParse({
    verdict: "approve", summary: "Review.",
    issues: [{ file: "src/a.ts", severity: "nit", message: "Issue.", ...invalid }],
  }).success).toBe(false);
});

it.each(["blocker", "major", "minor", "nit"] as const)("derives the verdict for %s", (severity) => {
  const verdict = severity === "major" || severity === "blocker" ? "changes_requested" : "approve";
  const raw = {
    verdict: verdict === "approve" ? "changes_requested" : "approve", summary: "Review.",
    issues: [{ file: "src/a.ts", severity, message: "Issue.", line: null }],
  };
  const before = structuredClone(raw);
  expect(normalizeReview(raw)).toEqual({
    verdict, summary: "Review.", issues: [{ file: "src/a.ts", severity, message: "Issue." }],
  });
  expect(raw).toEqual(before);
});

it("ignores missing or invalid model verdicts and preserves valid line numbers", () => {
  expect(normalizeReview({ summary: "Fine.", issues: [] })).toEqual({ verdict: "approve", summary: "Fine.", issues: [] });
  const issues = [
    { file: "a.ts", severity: "nit", message: "Issue." },
    { file: "b.ts", line: 3, severity: "minor", message: "Issue." },
  ];
  expect(normalizeReview({ verdict: 42, summary: "Fine.", issues })).toEqual({ verdict: "approve", summary: "Fine.", issues });
});

it.each([
  { file: "/tmp/file" }, { file: "../file" }, { file: "" }, { file: "src\\file" },
  { severity: "critical" }, { message: undefined }, { line: 0 }, { line: 1.5 }, { line: "2" },
])("rejects malformed raw issues %j", (invalid) => {
  expect(() => normalizeReview({
    summary: "Review.", issues: [{ file: "a.ts", severity: "minor", message: "Issue.", ...invalid }],
  })).toThrow(Error);
});

it.each([null, [], {}, { summary: 42, issues: [] }, { summary: "Review.", issues: null }])(
  "rejects malformed raw reviews %j", (raw) => {
    expect(() => normalizeReview(raw)).toThrow(Error);
  },
);

it("names invalid fields in normalization errors", () => {
  expect(() => normalizeReview({ summary: 42, issues: [] })).toThrow(/summary/);
});

it("normalizes the recorded Claude review result and structured output", () => {
  const sample = z.object({ result: z.string(), structured_output: z.unknown() }).parse(JSON.parse(
    readFileSync(new URL("../../../fixtures/providers/claude/print-json-review.sample.json", import.meta.url), "utf8"),
  ));
  const result = normalizeReview(JSON.parse(sample.result));
  expect(result).toEqual(normalizeReview(sample.structured_output));
  expect(result.verdict).toBe("changes_requested");
  expect(result.issues).toHaveLength(4);
});

it("normalizes the last recorded Codex agent message", () => {
  const lines = readFileSync(new URL("../../../fixtures/providers/codex/exec-json-review.sample.jsonl", import.meta.url), "utf8")
    .trim().split("\n");
  const messageSchema = z.object({
    type: z.literal("item.completed"), item: z.object({ type: z.literal("agent_message"), text: z.string() }),
  });
  const messages = lines.map((line) => messageSchema.safeParse(JSON.parse(line)))
    .filter((result) => result.success);
  const last = messages.at(-1)?.data;
  if (!last) throw new Error("Missing agent message");
  const result = normalizeReview(JSON.parse(last.item.text));
  expect(result.verdict).toBe("approve");
  expect(result.issues).toMatchObject([{ severity: "minor", file: "slug.js", line: 2 }]);
});
