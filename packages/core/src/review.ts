import { z } from "zod";
import { repoRelativePathSchema } from "./path.js";

export const reviewResultSchema = z.object({
  verdict: z.enum(["approve", "changes_requested"]),
  summary: z.string(),
  issues: z.array(z.object({
    file: repoRelativePathSchema,
    line: z.number().int().min(1).optional(),
    severity: z.enum(["blocker", "major", "minor", "nit"]),
    message: z.string(),
  })),
}).refine((result) => {
  const needsChanges = result.issues.some((issue) =>
    issue.severity === "blocker" || issue.severity === "major");
  return result.verdict === (needsChanges ? "changes_requested" : "approve");
}, {
  path: ["verdict"],
  message: "verdict must be changes_requested for blocker or major issues, and approve otherwise",
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;
