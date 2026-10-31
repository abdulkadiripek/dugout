import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import { promisify } from "node:util";
import type { Deps, IO } from "./cli.js";
import type { Config } from "./config.js";
import { delegate } from "./delegate.js";
import { findRepoRoot } from "./worktree.js";

const exec = promisify(execFile);

interface Options {
  selector: string;
  eventsDir: string;
  evalsDir: string | undefined;
  keep: boolean;
  providers: string | undefined;
  scenario: string | undefined;
}

function select(evalsDir: string, selector: string): string[] {
  const dirs = readdirSync(evalsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const runnable = (dir: string) => existsSync(join(evalsDir, dir, "seed")) && existsSync(join(evalsDir, dir, "check"));
  if (selector === "all") return dirs.filter(runnable);
  const found = dirs.filter((dir) => dir === selector || dir.startsWith(`${selector}-`) || dir.replace(/^\d+-/, "") === selector);
  const only = found.length === 1 ? found[0] : undefined;
  if (only === undefined) throw new Error(`Unknown eval task: ${selector}`);
  if (!runnable(only)) throw new Error(`Eval task ${only} has no seed/ and check/`);
  return found;
}

async function seedRepo(seed: string): Promise<string> {
  const repo = mkdtempSync(join(tmpdir(), "dugout-eval-"));
  try {
    cpSync(seed, repo, { recursive: true });
    await exec("git", ["init", "-b", "main"], { cwd: repo });
    await exec("git", ["add", "-A"], { cwd: repo });
    await exec("git", ["-c", "user.name=dugout", "-c", "user.email=dugout@localhost", "commit", "-m", "seed"], { cwd: repo });
  } catch (error) {
    rmSync(repo, { recursive: true, force: true });
    throw error;
  }
  return repo;
}

export async function evalTasks(options: Options, io: IO, config: Config, deps: Deps): Promise<number> {
  if (options.providers === undefined && options.scenario === undefined) {
    throw new Error("eval needs --providers or --scenario: real runs spend subscription quota");
  }
  const evalsDir = options.evalsDir ?? join(await findRepoRoot(io.cwd), "evals", "tasks");
  const tasks = select(evalsDir, options.selector);
  const home = io.homedir ?? homedir();
  let passed = 0;
  for (const name of tasks) {
    const taskDir = join(evalsDir, name);
    const repo = await seedRepo(join(taskDir, "seed"));
    let block = "";
    try {
      const code = await delegate(
        { file: join(taskDir, "task.md"), eventsDir: options.eventsDir, repo, providers: options.providers, scenario: options.scenario, overlay: join(taskDir, "check") },
        { ...io, stdout: (text) => { block += text; } }, config, deps,
      );
      if (code === 130) return 130;
      const field = (key: string) => new RegExp(`^${key}: (.*)$`, "m").exec(block)?.[1] ?? "";
      if (field("status") === "passed") passed++;
      io.stdout(`${name}  ${field("status")}  ${field("attempts")} attempts  ${field("providers")}\n`);
      if (options.keep) io.stdout(`kept: ${repo === home || repo.startsWith(home + sep) ? `~${repo.slice(home.length)}` : repo}\n`);
    } finally {
      if (!options.keep) rmSync(repo, { recursive: true, force: true });
    }
  }
  io.stdout(`passed ${passed}/${tasks.length}\n`);
  return 0;
}
