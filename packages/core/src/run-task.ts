import type { ProviderAdapter, VerifyOutcome } from "./adapter.js";
import type { Event } from "./events.js";
import type { ProviderName, TaskPackage } from "./task-package.js";

type TaskFinished = Extract<Event, { type: "task.finished" }>;
type EventPayload<T = Event> = T extends Event
  ? Omit<T, "schemaVersion" | "seq" | "ts" | "taskId"> : never;

export interface RunTaskDeps {
  now(): Date;
  newId(): string;
  adapters: Partial<Record<ProviderName, ProviderAdapter>>;
  runVerify(cwd: string, command: string): Promise<VerifyOutcome>;
  diffStat(): Promise<TaskFinished["diffStat"]>;
  models: {
    implement: Record<ProviderName, string>;
    review: Record<ProviderName, string>;
  };
  emit(event: Event): void;
  worktree: Pick<Extract<Event, { type: "worktree.created" }>, "path" | "branch" | "baseRef">;
  signal: AbortSignal;
}

function buildPrompt(pkg: TaskPackage): string {
  return [
    `Goal:\n${pkg.goal}`,
    `Files to read:\n${pkg.files_to_read.join("\n")}`,
    `Constraints:\n${pkg.constraints.join("\n")}`,
    `Acceptance:\n${pkg.acceptance.join("\n")}`,
    `Verify:\n${pkg.verify}`,
  ].join("\n\n");
}

function reviewer(pkg: TaskPackage, implementer: ProviderName): ProviderName {
  return pkg.providers.find((provider) => provider !== implementer) ?? implementer;
}

export async function runTask(
  pkg: TaskPackage, deps: RunTaskDeps,
): Promise<{ status: TaskFinished["status"]; taskId: string }> {
  const start = deps.now().getTime();
  const taskId = `${pkg.id}-${deps.newId()}`;
  let seq = 0;
  const emit = (event: EventPayload): void => {
    deps.emit({ ...event, schemaVersion: 1, seq: seq++, ts: deps.now().toISOString(), taskId });
  };
  const adapterFor = (provider: ProviderName): ProviderAdapter => {
    const adapter = deps.adapters[provider];
    if (!adapter) throw new Error(`Missing adapter for provider ${provider}`);
    return adapter;
  };
  const originalPrompt = buildPrompt(pkg);
  let attempts = 0;
  const providers: ProviderName[] = [];
  let status: TaskFinished["status"] = "failed";
  emit({ type: "task.created", package: pkg });
  emit({ type: "worktree.created", ...deps.worktree });

  providerLoop: for (const [index, provider] of pkg.providers.entries()) {
    const adapter = adapterFor(provider);
    let prompt = originalPrompt;
    for (let retries = 0; retries <= pkg.max_retries; retries++) {
      const attempt = ++attempts;
      if (!providers.includes(provider)) providers.push(provider);
      emit({
        type: "attempt.started", attempt, provider, model: deps.models.implement[provider],
        reason: retries > 0 ? "retry" : index === 0 ? "initial" : "fallback",
      });
      const run = adapter.run({
        taskId, attempt, cwd: deps.worktree.path, prompt,
        model: deps.models.implement[provider], signal: deps.signal,
      });
      let next = await run.next();
      while (!next.done) {
        emit(next.value);
        next = await run.next();
      }
      const { exitReason, durationMs } = next.value;
      emit({
        type: "attempt.finished", attempt, exitReason, durationMs,
        status: exitReason === "ok" ? "completed" : "failed",
      });
      if (exitReason === "rate_limit" || exitReason === "auth" || exitReason === "crash") {
        const to = pkg.providers[index + 1];
        if (!to) break providerLoop;
        emit({ type: "fallback.triggered", from: provider, to, reason: exitReason });
        continue providerLoop;
      }
      if (exitReason === "ok") {
        emit({ type: "verify.started", attempt, command: pkg.verify });
        const outcome = await deps.runVerify(deps.worktree.path, pkg.verify);
        const outputTail = outcome.outputTail.split(/\r?\n/).slice(-30).join("\n");
        emit({ type: "verify.finished", attempt, ...outcome, outputTail });
        if (outcome.passed) {
          status = "passed";
          if (pkg.review) {
            const reviewProvider = reviewer(pkg, provider);
            const model = deps.models.review[reviewProvider];
            emit({ type: "review.started", provider: reviewProvider, model });
            const result = await adapterFor(reviewProvider).review({
              taskId, cwd: deps.worktree.path, baseRef: deps.worktree.baseRef,
              model, signal: deps.signal,
            });
            emit({ type: "review.finished", provider: reviewProvider, model, result });
            status = result.verdict === "approve" ? "passed" : "needs_review";
          }
          break providerLoop;
        }
        prompt = `${originalPrompt}\n\nVerification failed:\n${outputTail}`;
      } else {
        prompt = `${originalPrompt}\n\nPrevious attempt ended: ${exitReason}`;
      }
    }
    break;
  }
  const diffStat = await deps.diffStat();
  emit({
    type: "task.finished", status, attempts, providers, diffStat,
    durationMs: deps.now().getTime() - start,
  });
  return { status, taskId };
}
