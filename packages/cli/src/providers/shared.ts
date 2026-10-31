import { isAbsolute, relative, sep } from "node:path";
import type { SpawnFn } from "./spawn.js";

export interface AdapterOptions {
  spawn?: SpawnFn;
  attemptTimeoutMs?: number;
  allowedTools?: string[];
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
const wrapper = /^(?:\S*\/)?(?:bash|sh)\s+-l?c\s+(?:'([\s\S]*)'|"([\s\S]*)"|([\s\S]*))$/;
export function shellSummary(command: string, cwd?: string): string {
  const match = wrapper.exec(command.trim());
  const inner = match ? match[1] ?? match[2] ?? match[3] ?? "" : command;
  const line = inner.trim().split("\n")[0] ?? "";
  return line.split(/\s+/).filter(word => word !== "").slice(0, 3)
    .map(word => {
      const eq = word.indexOf("=");
      const cut = eq === -1 ? word : `${word.slice(0, eq)}=…`;
      return cwd === undefined ? cut : cut.split(`${cwd}/`).join("");
    }).join(" ").slice(0, 60);
}
export function pathSummary(path: string, cwd: string): string {
  if (!isAbsolute(path)) return path;
  const local = relative(cwd, path);
  return local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local) ? "(outside worktree)" : local;
}
