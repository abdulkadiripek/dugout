import { z } from "zod";
import { providerNameSchema, taskPackageSchema } from "./task-package.js";
import { reviewResultSchema } from "./review.js";

export const exitReasonSchema = z.enum([
  "ok", "rate_limit", "auth", "timeout", "crash", "invalid_output",
]);
export type ExitReason = z.infer<typeof exitReasonSchema>;

const count = z.number().int().nonnegative();
const attempt = z.number().int().min(1);
const durationMs = z.number().nonnegative();
const envelope = z.object({
  schemaVersion: z.literal(1),
  seq: count,
  ts: z.iso.datetime(),
  taskId: z.string(),
});

export const eventSchema = z.discriminatedUnion("type", [
  envelope.extend({ type: z.literal("task.created"), package: taskPackageSchema }),
  envelope.extend({
    type: z.literal("worktree.created"),
    path: z.string(), branch: z.string(), baseRef: z.string(),
  }),
  envelope.extend({
    type: z.literal("attempt.started"), attempt,
    reason: z.enum(["initial", "retry", "fallback"]),
    provider: providerNameSchema, model: z.string(),
  }),
  envelope.extend({
    type: z.literal("provider.tool"), attempt, name: z.string(), summary: z.string(),
  }),
  envelope.extend({ type: z.literal("provider.message"), attempt, text: z.string().max(500) }),
  envelope.extend({
    type: z.literal("provider.usage"), attempt,
    inputTokens: count.optional(), outputTokens: count.optional(),
  }),
  envelope.extend({
    type: z.literal("attempt.finished"), attempt,
    status: z.enum(["completed", "failed"]), exitReason: exitReasonSchema, durationMs,
  }),
  envelope.extend({
    type: z.literal("fallback.triggered"),
    from: providerNameSchema, to: providerNameSchema,
    reason: z.enum(["rate_limit", "auth", "crash"]),
  }),
  envelope.extend({
    type: z.literal("setup.finished"), passed: z.boolean(),
    exitCode: z.number().int(), durationMs, outputTail: z.string(),
  }),
  envelope.extend({ type: z.literal("verify.started"), attempt, command: z.string() }),
  envelope.extend({
    type: z.literal("verify.finished"), attempt, passed: z.boolean(),
    exitCode: z.number().int(), durationMs, outputTail: z.string(),
  }),
  envelope.extend({
    type: z.literal("review.started"), provider: providerNameSchema, model: z.string(),
  }),
  envelope.extend({
    type: z.literal("review.finished"), provider: providerNameSchema,
    model: z.string(), result: reviewResultSchema,
  }),
  envelope.extend({
    type: z.literal("task.finished"),
    status: z.enum(["passed", "needs_review", "failed"]),
    attempts: count, providers: z.array(providerNameSchema),
    diffStat: z.object({ files: count, additions: count, deletions: count }),
    durationMs,
  }),
]);

export type Event = z.infer<typeof eventSchema>;
