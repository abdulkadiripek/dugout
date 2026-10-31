import { normalizeReview, type ProviderAdapter, type AttemptResult } from "@panosu/core";
import { spawnReal, processLines } from "./spawn.js";
import { buildReviewPrompt, defaultGetDiff, reviewJsonSchema } from "./review-prompt.js";
import { object, parseLine, number, pathSummary, shellSummary, type AdapterOptions } from "./shared.js";

export function createClaudeAdapter(opts: AdapterOptions): ProviderAdapter {
  const spawn = opts.spawn ?? spawnReal;
  const timeout = opts.attemptTimeoutMs ?? 600000;
  const args = (prompt: string, model: string | undefined) => ["-p", prompt, ...(model === undefined ? [] : ["--model", model])];
  return {
    name: "claude",
    async *run(input) {
      const start = performance.now();
      let completed = false;
      let failed = false;
      let invalid = false;
      let usage: AttemptResult["usage"];
      let status: "ok" | "crash" | "timeout" = "crash";
      try {
        const child = spawn("claude", [...args(input.prompt, input.model), "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--permission-mode", "acceptEdits", "--allowedTools", "Write", "Edit", "Read"], { cwd: input.cwd });
        const lines = processLines(child, input.signal, timeout);
        while (true) {
          const next = await lines.next();
          if (next.done) { status = next.value; break; }
          let event: Record<string, unknown>;
          try { event = parseLine(next.value); } catch { invalid = true; continue; }
          if (event.type === "result") {
            completed = true;
            if (event.subtype !== "success" || event.is_error !== false) failed = true;
            const raw = object(event.usage);
            usage = { inputTokens: number(raw.input_tokens) + number(raw.cache_read_input_tokens) + number(raw.cache_creation_input_tokens), outputTokens: number(raw.output_tokens) };
            yield { type: "provider.usage", attempt: input.attempt, ...usage };
          }
          if (event.type !== "assistant") continue;
          const content = object(event.message).content;
          if (!Array.isArray(content)) continue;
          for (const value of content) {
            const item = object(value);
            if (item.type === "text" && typeof item.text === "string") {
              yield { type: "provider.message", attempt: input.attempt, text: item.text.slice(0, 500) };
            } else if (item.type === "tool_use" && typeof item.name === "string") {
              const toolInput = object(item.input);
              if (item.name === "Bash") {
                yield { type: "provider.tool", attempt: input.attempt, name: "bash", summary: typeof toolInput.command === "string" ? shellSummary(toolInput.command, input.cwd) : "" };
                continue;
              }
              const path = toolInput.file_path;
              yield { type: "provider.tool", attempt: input.attempt, name: item.name.toLowerCase(), summary: typeof path === "string" ? pathSummary(path, input.cwd) : "" };
            }
          }
        }
      } catch { status = "crash"; }
      const exitReason = status !== "ok" ? status : failed ? "crash" : invalid || !completed ? "invalid_output" : "ok";
      return { exitReason, durationMs: performance.now() - start, ...(usage ? { usage } : {}) };
    },
    async review(input) {
      try {
        const diff = await (opts.getDiff ?? defaultGetDiff)(input.cwd, input.baseRef);
        const prompt = buildReviewPrompt({ ...opts.context(), diff });
        const child = spawn("claude", [...args(prompt, input.model), "--output-format", "json", "--json-schema", JSON.stringify(reviewJsonSchema), "--no-session-persistence", "--tools", ""], { cwd: input.cwd });
        const lines = processLines(child, input.signal, timeout);
        const output: string[] = [];
        while (true) {
          const next = await lines.next();
          if (next.done) {
            if (next.value !== "ok") throw new Error("Unsuccessful review");
            break;
          }
          output.push(next.value);
        }
        const result = parseLine(output.join("\n"));
        if (result.is_error !== false || result.subtype !== "success") throw new Error("Unsuccessful review");
        const structured = result.structured_output;
        return normalizeReview(typeof structured === "object" && structured !== null && !Array.isArray(structured)
          ? structured : JSON.parse(typeof result.result === "string" ? result.result : ""));
      } catch { throw new Error("Claude review failed or returned invalid output"); }
    },
  };
}
