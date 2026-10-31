import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { summarizeLog } from "@panosu/core";
import type { IO } from "./cli.js";

export function list(dir: string, limit: number, io: IO): number {
  let files: string[];
  try { files = readdirSync(dir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  const rows = files.filter((file) => file.endsWith(".jsonl")).map((file) => {
    const id = file.slice(0, -6);
    let summary;
    try {
      const text = readFileSync(join(dir, file), "utf8");
      summary = summarizeLog(text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n"), id);
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ");
      return { ts: "", line: `${id}  unreadable  ${reason}` };
    }
    if (summary.status === "unreadable") {
      return { ts: "", line: `${id}  unreadable  ${summary.reason}` };
    }
    return {
      ts: summary.startedAt,
      line: `${summary.taskId}  ${summary.status}  ${summary.attempts} attempts  ${summary.providers.join(",")}`,
    };
  });
  rows.sort((a, b) => b.ts.localeCompare(a.ts));
  for (const row of rows.slice(0, limit)) io.stdout(row.line + "\n");
  return 0;
}
