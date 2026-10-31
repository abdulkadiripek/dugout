import type { ProviderAdapter, VerifyOutcome } from "./adapter.js";
import type { ExitReason } from "./events.js";
import type { ReviewResult } from "./review.js";
import { providerNameSchema, type ProviderName } from "./task-package.js";

export interface FakeOutcome {
  exit: ExitReason;
  verify?: "pass" | "fail";
  durationMs?: number;
}

export type FakeScenarioSpec = Partial<Record<ProviderName, readonly FakeOutcome[]>> & {
  review?: ReviewResult["verdict"];
};

export function createFakeScenario(spec: FakeScenarioSpec) {
  const adapters: Partial<Record<ProviderName, ProviderAdapter>> = {};
  const verification: ("pass" | "fail")[] = [];
  const verdict = spec.review ?? "approve";

  for (const name of providerNameSchema.options) {
    const configured = spec[name];
    if (!configured) continue;
    const outcomes = configured.map((outcome) => ({ ...outcome }));
    adapters[name] = {
      name,
      async *run(input) {
        if (input.signal.aborted) return { exitReason: "timeout", durationMs: 0 };
        const outcome = outcomes.shift();
        if (!outcome) throw new Error(`No outcomes left for provider ${name}`);
        if (outcome.exit === "ok") {
          verification.push(outcome.verify ?? "pass");
          yield { type: "provider.message", attempt: input.attempt, text: "fake: attempt complete." };
          yield { type: "provider.usage", attempt: input.attempt, inputTokens: 0, outputTokens: 0 };
        }
        return { exitReason: outcome.exit, durationMs: outcome.durationMs ?? 0 };
      },
      async review() {
        return {
          verdict,
          summary: "fake: review complete.",
          issues: verdict === "approve" ? [] : [{
            file: "src/example.ts", severity: "major", message: "Scripted issue requires changes.",
          }],
        };
      },
    };
  }

  async function runVerify(_cwd: string, _command: string): Promise<VerifyOutcome> {
    const result = verification.shift();
    if (!result) throw new Error("No verification outcomes left");
    const passed = result === "pass";
    return {
      passed, exitCode: passed ? 0 : 1, durationMs: 0,
      outputTail: passed ? "" : "Scripted verification failed.",
    };
  }

  return { adapters, runVerify };
}

export const scenarios = {
  success: (): FakeOutcome[] => [{ exit: "ok", verify: "pass" }],
  fail: (): FakeOutcome[] => [{ exit: "ok", verify: "fail" }],
  rate_limit: (): FakeOutcome[] => [{ exit: "rate_limit" }],
  crash: (): FakeOutcome[] => [{ exit: "crash" }],
};
