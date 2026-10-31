import { z } from "zod";
import { providerNameSchema } from "./task-package.js";

const count = z.number().int().nonnegative();

export const taskStatusSchema = z.enum([
  "passed", "needs_review", "failed", "interrupted", "unreadable",
]);

export const taskSummarySchema = z.object({
  taskId: z.string(),
  packageId: z.string(),
  goal: z.string(),
  status: taskStatusSchema,
  reason: z.string().optional(),
  providers: z.array(providerNameSchema),
  attempts: count,
  startedAt: z.string(),
  durationMs: z.number().nonnegative().nullable(),
  tokens: z.object({ input: count, output: count }),
  review: z.object({
    verdict: z.enum(["approve", "changes_requested"]),
    counts: z.object({ blocker: count, major: count, minor: count, nit: count }),
  }).nullable(),
  branch: z.string(),
  baseRef: z.string(),
});

export const implementerRowSchema = z.object({
  provider: providerNameSchema,
  model: z.string(),
  tasks: count,
  passed: count,
  firstTryPassRate: z.number().min(0).max(1),
  meanRetries: z.number().nonnegative(),
  meanDurationMs: z.number().nonnegative(),
  inputTokens: count,
  outputTokens: count,
});

export const reviewerRowSchema = z.object({
  provider: providerNameSchema,
  model: z.string(),
  reviews: count,
  blocker: count,
  major: count,
  minor: count,
  nit: count,
});

export const scorecardSchema = z.object({
  implementers: z.array(implementerRowSchema),
  reviewers: z.array(reviewerRowSchema),
  excluded: z.object({ interrupted: count, unreadable: count }),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskSummary = z.infer<typeof taskSummarySchema>;
export type ImplementerRow = z.infer<typeof implementerRowSchema>;
export type ReviewerRow = z.infer<typeof reviewerRowSchema>;
export type Scorecard = z.infer<typeof scorecardSchema>;
