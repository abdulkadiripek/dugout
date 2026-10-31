import type { Event, ExitReason } from "./events.js";
import type { ReviewResult } from "./review.js";
import type { ProviderName } from "./task-package.js";

export interface AttemptInput {
  taskId: string;
  attempt: number;
  cwd: string;
  prompt: string;
  model?: string;
  signal: AbortSignal;
}

export interface AttemptResult {
  exitReason: ExitReason;
  durationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
}

type WithoutEnvelope<T> = T extends Event
  ? Omit<T, "schemaVersion" | "seq" | "ts" | "taskId">
  : never;

export type ProviderEvent = WithoutEnvelope<Extract<Event, {
  type: "provider.tool" | "provider.message" | "provider.usage";
}>>;

export interface ReviewInput {
  taskId: string;
  cwd: string;
  baseRef: string;
  model?: string;
  signal: AbortSignal;
}

export interface ProviderAdapter {
  name: ProviderName;
  run(input: AttemptInput): AsyncGenerator<ProviderEvent, AttemptResult>;
  review(input: ReviewInput): Promise<ReviewResult>;
}

export type VerifyOutcome = Pick<Extract<Event, { type: "verify.finished" }>,
  "passed" | "exitCode" | "durationMs" | "outputTail">;
