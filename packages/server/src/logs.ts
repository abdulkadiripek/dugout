import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseLog, summarizeEvents, type Event, type TaskSummary } from "@panosu/core";

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const SUFFIX = ".jsonl";

export interface LogEntry {
  summary: TaskSummary;
  events: Event[];
}

export const isValidTaskId = (id: string): boolean => ID_PATTERN.test(id);

function unreadable(taskId: string, reason: string): LogEntry {
  return {
    events: [],
    summary: {
      taskId, packageId: "", goal: "", status: "unreadable", reason,
      providers: [], attempts: 0, startedAt: "", durationMs: null,
      tokens: { input: 0, output: 0 }, review: null, branch: "", baseRef: "",
    },
  };
}

async function loadEntry(path: string, taskId: string): Promise<LogEntry> {
  let text: string;
  try { text = await readFile(path, "utf8"); } catch (error) {
    return unreadable(taskId, (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " "));
  }
  const parsed = parseLog(text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n"));
  if (!parsed.ok) return unreadable(taskId, parsed.reason);
  return { summary: { ...summarizeEvents(parsed.events), taskId }, events: parsed.events };
}

export async function readLog(eventsDir: string, taskId: string): Promise<LogEntry | null> {
  if (!isValidTaskId(taskId)) return null;
  const path = join(eventsDir, taskId + SUFFIX);
  try {
    if (!(await lstat(path)).isFile()) return null;
  } catch { return null; }
  return loadEntry(path, taskId);
}

export async function readAllLogs(eventsDir: string): Promise<LogEntry[]> {
  let names: string[];
  try {
    const dirents = await readdir(eventsDir, { withFileTypes: true });
    names = dirents.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR") return [];
    throw error;
  }
  const ids = names.filter((name) => name.endsWith(SUFFIX)).map((name) => name.slice(0, -SUFFIX.length))
    .filter(isValidTaskId);
  return Promise.all(ids.map((id) => loadEntry(join(eventsDir, id + SUFFIX), id)));
}
