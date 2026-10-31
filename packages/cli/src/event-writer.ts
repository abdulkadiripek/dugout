import { appendFileSync, closeSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { eventSchema, type Event } from "@panosu/core";

export interface EventWriter {
  path: string;
  emit(event: Event): void;
}

export function createEventWriter(dir: string, taskId: string): EventWriter {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(taskId)) throw new Error("Invalid taskId");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${taskId}.jsonl`);
  closeSync(openSync(path, "wx"));
  return {
    path,
    emit(event) {
      const validated = eventSchema.parse(event);
      appendFileSync(path, `${JSON.stringify(validated)}\n`, "utf8");
    },
  };
}
