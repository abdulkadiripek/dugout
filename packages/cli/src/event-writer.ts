import { appendFileSync, closeSync, mkdirSync, openSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { join } from "node:path";
import { eventSchema, type Event } from "@dugout/core";

export interface EventWriter {
  path: string;
  emit(event: Event): void;
}

function scrubString(value: string, home: string): string {
  let out = "";
  let from = 0;
  for (let at = value.indexOf(home); at !== -1; at = value.indexOf(home, from)) {
    const next = value[at + home.length];
    out += value.slice(from, at);
    if (next === undefined || next === "/") out += "~";
    else out += home;
    from = at + home.length;
  }
  return out + value.slice(from);
}

function scrub(value: unknown, home: string): unknown {
  if (typeof value === "string") return scrubString(value, home);
  if (Array.isArray(value)) return value.map(item => scrub(item, home));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item, home)]));
  }
  return value;
}

export function createEventWriter(dir: string, taskId: string, opts: { homedir?: string } = {}): EventWriter {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(taskId)) throw new Error("Invalid taskId");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${taskId}.jsonl`);
  closeSync(openSync(path, "wx"));
  const home = (opts.homedir ?? osHomedir()).replace(/\/+$/, "");
  return {
    path,
    emit(event) {
      const validated = eventSchema.parse(event);
      const line = home === "" ? validated : scrub(validated, home);
      appendFileSync(path, `${JSON.stringify(line)}\n`, "utf8");
    },
  };
}
