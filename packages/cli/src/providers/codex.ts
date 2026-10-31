import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeReview, type ProviderAdapter, type AttemptResult } from "@panosu/core";
import { spawnReal, processLines } from "./spawn.js";
import { buildReviewPrompt, defaultGetDiff, reviewJsonSchema } from "./review-prompt.js";
import { object, parseLine, number, pathSummary, type AdapterOptions } from "./shared.js";

const usageLimit = (event: Record<string, unknown>): boolean => {
  if (event.type !== "error" && event.type !== "turn.failed") return false;
  const message = typeof event.message === "string" ? event.message : object(event.error).message;
  return typeof message === "string" && message.toLowerCase().includes("usage limit");
};

class UsageLimitError extends Error {}

export function createCodexAdapter(opts: AdapterOptions): ProviderAdapter {
  const spawn = opts.spawn ?? spawnReal;
  const timeout = opts.attemptTimeoutMs ?? 600000;
  const args = (model: string | undefined, cwd: string, sandbox: string) =>
    ["exec", "--json", ...(model === undefined ? [] : ["-m", model]), "-s", sandbox, "-C", cwd];
  return {
    name: "codex",
    async *run(input) {
      const start = performance.now();
      let completed = false;
      let failed = false;
      let invalid = false;
      let limited = false;
      let usage: AttemptResult["usage"];
      let status: "ok" | "crash" | "timeout" = "crash";
      try {
        const child = spawn("codex", [...args(input.model, input.cwd, "workspace-write"), input.prompt], { cwd: input.cwd });
        const lines = processLines(child, input.signal, timeout);
        while (true) {
          const next = await lines.next();
          if (next.done) { status = next.value; break; }
          let event: Record<string, unknown>;
          try { event = parseLine(next.value); } catch { invalid = true; continue; }
          if (event.type === "error" || event.type === "turn.failed") failed = true;
          if (usageLimit(event)) limited = true;
          if (event.type === "turn.completed") {
            completed = true;
            const raw = object(event.usage);
            usage = { inputTokens: number(raw.input_tokens), outputTokens: number(raw.output_tokens) };
            yield { type: "provider.usage", attempt: input.attempt, ...usage };
          }
          if (event.type !== "item.completed") continue;
          const item = object(event.item);
          if (item.type === "agent_message" && typeof item.text === "string") {
            yield { type: "provider.message", attempt: input.attempt, text: item.text.slice(0, 500) };
          } else if (item.type === "command_execution" && typeof item.command === "string") {
            const summary = (item.command.split("\n")[0] ?? "").split(`${input.cwd}/`).join("").slice(0, 80);
            yield { type: "provider.tool", attempt: input.attempt, name: "command", summary };
          } else if (item.type === "file_change" && Array.isArray(item.changes)) {
            const summary = item.changes.map(change => object(change).path).filter((path): path is string => typeof path === "string")
              .map(path => pathSummary(path, input.cwd)).join(", ").slice(0, 200);
            yield { type: "provider.tool", attempt: input.attempt, name: "edit", summary };
          }
        }
      } catch { status = "crash"; }
      const exitReason = status === "crash" && limited ? "rate_limit" : status !== "ok" ? status : failed ? "crash" : invalid || !completed ? "invalid_output" : "ok";
      return { exitReason, durationMs: performance.now() - start, ...(usage ? { usage } : {}) };
    },
    async review(input) {
      let dir: string | undefined;
      try {
        const diff = await (opts.getDiff ?? defaultGetDiff)(input.cwd, input.baseRef);
        const prompt = buildReviewPrompt({ ...opts.context(), diff });
        dir = await mkdtemp(join(tmpdir(), "panosu-review-"));
        const schema = join(dir, "schema.json");
        await writeFile(schema, JSON.stringify(reviewJsonSchema));
        const child = spawn("codex", [...args(input.model, input.cwd, "read-only"), "--skip-git-repo-check", "--ephemeral", "--output-schema", schema, "-o", join(dir, "output.json"), prompt], { cwd: input.cwd });
        const lines = processLines(child, input.signal, timeout);
        let text = "";
        let completed = false;
        let failed = false;
        let limited = false;
        while (true) {
          const next = await lines.next();
          if (next.done) {
            if (limited && next.value === "crash") throw new UsageLimitError("Codex usage limit reached; review unavailable");
            if (next.value !== "ok" || failed || !completed) throw new Error("Unsuccessful review");
            break;
          }
          let event: Record<string, unknown>;
          try { event = parseLine(next.value); } catch { failed = true; continue; }
          if (event.type === "error" || event.type === "turn.failed") failed = true;
          if (usageLimit(event)) limited = true;
          if (event.type === "turn.completed") completed = true;
          const item = object(event.item);
          if (event.type === "item.completed" && item.type === "agent_message" && typeof item.text === "string") text = item.text;
        }
        return normalizeReview(JSON.parse(text));
      } catch (error) {
        if (error instanceof UsageLimitError) throw error;
        throw new Error("Codex review failed or returned invalid output");
      }
      finally { if (dir) await rm(dir, { recursive: true, force: true }); }
    },
  };
}
