import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { delegate } from "./delegate.js";
import type { SpawnFn } from "./providers/index.js";
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
    if (command !== "delegate" && command !== "list") throw new Error("Usage: panosu delegate <task.md> | list");
    const { values, positionals } = parseArgs({ args: argv.slice(1), options: {
      providers: { type: "string" }, scenario: { type: "string" }, repo: { type: "string" },
      limit: { type: "string" }, "events-dir": { type: "string" },
    }, allowPositionals: true });
    const forbidden = command === "list" ? ["providers", "scenario", "repo"] as const : ["limit"] as const;
    for (const flag of forbidden) if (values[flag] !== undefined) throw new Error(`Unsupported flag for ${command}: --${flag}`);
    const config = loadConfig(join(home, ".ajan-panosu", "config.json"));
    const eventsDir = resolve(io.cwd, values["events-dir"] ?? join(home, ".ajan-panosu", "events"));
    if (command === "list") {
      if (positionals.length) throw new Error("Usage: panosu list [--limit <n>]");
      const limit = values.limit ?? "20";
      if (!/^\d+$/.test(limit) || !Number.isSafeInteger(Number(limit))) throw new Error("limit must be a nonnegative integer");
      return list(eventsDir, Number(limit), io);
    }
    if (positionals.length !== 1 || !positionals[0]) throw new Error("Usage: panosu delegate <task.md>");
    return await delegate({ file: resolve(io.cwd, positionals[0]), eventsDir, repo: values.repo, providers: values.providers, scenario: values.scenario }, { ...io, homedir: home }, config, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message.split(home).join("~")}\n`);
    return 3;
  }
}
