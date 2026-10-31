import { readFile } from "node:fs/promises";
import type { AttemptInput, ProviderAdapter, ProviderEvent } from "@panosu/core";
import type { SpawnedProcess } from "./spawn.js";

export const input: AttemptInput = { taskId: "test", attempt: 1, cwd: "/tmp/panosu-worktree", prompt: "implement exactly", model: "test-model", signal: new AbortController().signal };
export const context = () => ({ goal: "Test goal", acceptance: ["First criterion", "Second criterion"] });
export const reviewInput = { ...input, baseRef: "HEAD" };
export async function sample(path: string): Promise<string[]> {
  return (await readFile(new URL(`../../../../fixtures/providers/${path}`, import.meta.url), "utf8"))
    .replaceAll("<worktree>", input.cwd).trimEnd().split("\n");
}
export function scripted(lines: string[], code: number | null = 0, neverExits = false, signal: NodeJS.Signals | null = null): SpawnedProcess & { kills: NodeJS.Signals[] } {
  const kills: NodeJS.Signals[] = [];
  return {
    kills,
    lines: (async function* () {
      for (const line of lines) yield line;
      if (neverExits) await new Promise<never>(() => {});
    })(),
    stderr: () => "",
    exited: neverExits ? new Promise(() => {}) : Promise.resolve({ code, signal }),
    killGroup: signal => { kills.push(signal); },
  };
}
export async function collect(adapter: ProviderAdapter, attempt = input) {
  const events: ProviderEvent[] = [];
  const run = adapter.run(attempt);
  while (true) {
    const next = await run.next();
    if (next.done) return { events, result: next.value };
    events.push(next.value);
  }
}
