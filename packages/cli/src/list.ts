import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { eventSchema, type Event } from "@panosu/core";
import type { IO } from "./cli.js";

export function list(dir: string, limit: number, io: IO): number {
  let files: string[];
  try { files = readdirSync(dir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  const rows = files.filter((file) => file.endsWith(".jsonl")).map((file) => {
    let ts = "";
    const id = file.slice(0, -6);
    try {
      const text = readFileSync(join(dir, file), "utf8");
      const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
      const events: Event[] = lines.map((line, index) => {
        let value: unknown;
        try { value = JSON.parse(line); } catch { throw new Error(`bad JSON line ${index + 1}`); }
        const parsed = eventSchema.safeParse(value);
        if (!parsed.success) throw new Error(`schema failure on line ${index + 1}: ${parsed.error.message}`);
        if (parsed.data.seq !== index) throw new Error(`non-contiguous seq on line ${index + 1}`);
        if (parsed.data.type === "task.created") ts = parsed.data.ts;
        return parsed.data;
      });
      if (events[0]?.type !== "task.created") throw new Error("missing task.created");
      const finished = events.findLast((event) => event.type === "task.finished");
      const attempts = events.filter((event) => event.type === "attempt.started");
      const providers = [...new Set(attempts.map((event) => event.provider))];
      return { ts, line: `${events[0].taskId}  ${finished?.status ?? "interrupted"}  ${finished?.attempts ?? attempts.length} attempts  ${(finished?.providers ?? providers).join(",")}` };
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ");
      return { ts, line: `${id}  unreadable  ${reason}` };
    }
  });
  rows.sort((a, b) => b.ts.localeCompare(a.ts));
  for (const row of rows.slice(0, limit)) io.stdout(row.line + "\n");
  return 0;
}
