import { expect, it } from "vitest";
import { reviewResultSchema } from "./index.js";

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
