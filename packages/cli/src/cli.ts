import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { delegate } from "./delegate.js";
import type { SpawnFn } from "./providers/index.js";
import { evalTasks } from "./eval.js";
import { list } from "./list.js";

export interface IO {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
  homedir?: string;
}
export interface Deps { newId?(): string; now?(): Date; spawn?: SpawnFn }

export async function main(argv: string[], io: IO, deps: Deps = {}): Promise<number> {
  const home = io.homedir ?? homedir();
  try {
    const command = argv[0];
    if (command !== "delegate" && command !== "list" && command !== "eval") throw new Error("Usage: dugout delegate <task.md> | list | eval <task|all>");
    const { values, positionals } = parseArgs({ args: argv.slice(1), options: {
      providers: { type: "string" }, scenario: { type: "string" }, repo: { type: "string" },
      limit: { type: "string" }, "events-dir": { type: "string" }, "evals-dir": { type: "string" }, keep: { type: "boolean" },
    }, allowPositionals: true });
    const forbidden = command === "list" ? ["providers", "scenario", "repo", "evals-dir", "keep"] as const
      : command === "eval" ? ["limit", "repo"] as const : ["limit", "evals-dir", "keep"] as const;
    for (const flag of forbidden) if (values[flag] !== undefined) throw new Error(`Unsupported flag for ${command}: --${flag}`);
    const config = loadConfig(join(home, ".dugout", "config.json"));
    const eventsDir = resolve(io.cwd, values["events-dir"] ?? join(home, ".dugout", "events"));
    if (command === "list") {
      if (positionals.length) throw new Error("Usage: dugout list [--limit <n>]");
      const limit = values.limit ?? "20";
      if (!/^\d+$/.test(limit) || !Number.isSafeInteger(Number(limit))) throw new Error("limit must be a nonnegative integer");
      return list(eventsDir, Number(limit), io);
    }
    if (command === "eval") {
      if (positionals.length !== 1 || !positionals[0]) throw new Error("Usage: dugout eval <task|all> (--providers <list> | --scenario <name>)");
      return await evalTasks({ selector: positionals[0], eventsDir, evalsDir: values["evals-dir"] === undefined ? undefined : resolve(io.cwd, values["evals-dir"]), keep: values.keep === true, providers: values.providers, scenario: values.scenario }, { ...io, homedir: home }, config, deps);
    }
    if (positionals.length !== 1 || !positionals[0]) throw new Error("Usage: dugout delegate <task.md>");
    return await delegate({ file: resolve(io.cwd, positionals[0]), eventsDir, repo: values.repo, providers: values.providers, scenario: values.scenario }, { ...io, homedir: home }, config, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message.split(home).join("~")}\n`);
    return 3;
  }
}
