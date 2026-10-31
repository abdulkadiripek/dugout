import { z } from "zod";
import { repoRelativePathSchema } from "./path.js";

const reviewIssueSchema = z.object({
  file: repoRelativePathSchema,
  line: z.number().int().min(1).optional(),
  severity: z.enum(["blocker", "major", "minor", "nit"]),
  message: z.string(),
});

export const reviewResultSchema = z.object({
  verdict: z.enum(["approve", "changes_requested"]),
  summary: z.string(),
  issues: z.array(reviewIssueSchema),
}).refine((result) => {
  const needsChanges = result.issues.some((issue) =>
    issue.severity === "blocker" || issue.severity === "major");
  return result.verdict === (needsChanges ? "changes_requested" : "approve");
}, {
  path: ["verdict"],
  message: "verdict must be changes_requested for blocker or major issues, and approve otherwise",
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;

const rawReviewSchema = z.object({
  summary: z.string(),
  issues: z.array(reviewIssueSchema.extend({ line: reviewIssueSchema.shape.line.nullable() })),
});

export function normalizeReview(raw: unknown): ReviewResult {
  const parsed = rawReviewSchema.parse(raw);
  const issues = parsed.issues.map(({ line, ...issue }) =>
    line == null ? issue : { ...issue, line });
  const verdict = issues.some((issue) => issue.severity === "blocker" || issue.severity === "major")
    ? "changes_requested" : "approve";
  return reviewResultSchema.parse({ summary: parsed.summary, issues, verdict });
}
