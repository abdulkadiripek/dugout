import { isAbsolute, relative, sep } from "node:path";
import type { SpawnFn } from "./spawn.js";

export interface AdapterOptions {
  spawn?: SpawnFn;
  attemptTimeoutMs?: number;
  getDiff?: (cwd: string, baseRef: string) => Promise<string>;
  context: () => { goal: string; acceptance: string[] };
}

export function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function parseLine(line: string): Record<string, unknown> {
  return object(JSON.parse(line));
}
export function number(value: unknown): number { return typeof value === "number" ? value : 0; }
export function pathSummary(path: string, cwd: string): string {
  if (!isAbsolute(path)) return path;
  const local = relative(cwd, path);
  return local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local) ? "(outside worktree)" : local;
}
