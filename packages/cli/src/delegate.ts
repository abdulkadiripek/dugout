import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { createFakeScenario, parseTaskPackage, runTask, type Event, type ProviderAdapter, type ProviderName, type TaskPackage, type VerifyOutcome } from "@panosu/core";
import type { IO, Deps } from "./cli.js";
import type { Config } from "./config.js";
import { createEventWriter } from "./event-writer.js";
import { createCodexAdapter, createClaudeAdapter, spawnReal } from "./providers/index.js";
import { scenarioSpec } from "./scenarios.js";
import { runVerifyCommand } from "./verify-runner.js";
import { commitAll, createWorktree, currentBase, diffStat, findRepoRoot, stageAll } from "./worktree.js";

interface Options { file: string; eventsDir: string; repo: string | undefined; providers: string | undefined; scenario: string | undefined; overlay?: string }
const exec = promisify(execFile);

async function excludeWorktrees(repo: string): Promise<void> {
  const { stdout } = await exec("git", ["rev-parse", "--git-path", "info/exclude"], { cwd: repo });
  const path = resolve(repo, stdout.trim());
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!text.split(/\r?\n/).includes(".worktrees/")) appendFileSync(path, `${text.endsWith("\n") || !text ? "" : "\n"}.worktrees/\n`);
}

function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(resolve(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]);
}

async function verifyWithOverlay(overlay: string, cwd: string, run: () => Promise<VerifyOutcome>, io: IO): Promise<VerifyOutcome> {
  const files = listFiles(overlay);
  const clash = files.find((file) => existsSync(resolve(cwd, file)));
  if (clash !== undefined) {
    const message = `check file would overwrite an existing file: ${clash}`;
    io.stderr(`${message}\n`);
    return { passed: false, exitCode: 1, durationMs: 0, outputTail: message };
  }
  const dirs = new Set<string>();
  try {
    for (const file of files) {
      const target = resolve(cwd, file);
      for (let dir = dirname(target); dir !== cwd && !existsSync(dir); dir = dirname(dir)) dirs.add(dir);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(resolve(overlay, file), target);
    }
    return await run();
  } finally {
    for (const file of files) rmSync(resolve(cwd, file), { force: true });
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
      try { rmdirSync(dir); } catch { /* not empty: the verify command made files there */ }
    }
  }
}

function validatePaths(repo: string, paths: string[]): void {
  for (const path of paths) {
    let candidate = resolve(repo, path);
    while (true) {
      try {
        const resolved = relative(repo, realpathSync(candidate));
        if (resolved === ".." || resolved.startsWith(`..${sep}`) || isAbsolute(resolved)) throw new Error(`files_to_read: path escapes repository: ${path}`);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        candidate = dirname(candidate);
      }
    }
  }
}

function report(events: Event[], log: string, io: IO): void {
  const finished = events.findLast((event) => event.type === "task.finished");
  if (!finished || finished.type !== "task.finished") throw new Error("Missing task.finished");
  const review = events.findLast((event) => event.type === "review.finished");
  const counts = ["blocker", "major", "minor", "nit"].map((severity) => `${severity} ${review?.type === "review.finished" ? review.result.issues.filter((issue) => issue.severity === severity).length : 0}`).join(", ");
  const verdict = review?.type === "review.finished" ? `${review.result.verdict} (${counts})` : "skipped";
  const home = io.homedir;
  const display = home && (log === home || log.startsWith(home + sep)) ? `~${log.slice(home.length)}` : log;
  io.stdout(`task: ${finished.taskId}\nstatus: ${finished.status}\nattempts: ${finished.attempts}\nproviders: ${finished.providers.join(",")}\nreview: ${verdict}\nlog: ${display}\n`);
}

function buildAdapters(pkg: TaskPackage, scenario: string | undefined, deps: Deps): Partial<Record<ProviderName, ProviderAdapter>> {
  if (scenario !== undefined || pkg.providers.every(provider => provider === "fake")) {
    return createFakeScenario(scenarioSpec(scenario ?? "success", pkg.providers)).adapters;
  }
  if (pkg.providers.includes("fake")) throw new Error("fake cannot be mixed with other providers");
  const options = {
    spawn: deps.spawn ?? spawnReal,
    context: () => ({ goal: pkg.goal, acceptance: pkg.acceptance }),
  };
  const adapters: Partial<Record<ProviderName, ProviderAdapter>> = {};
  for (const provider of pkg.providers) {
    if (provider === "codex") adapters.codex = createCodexAdapter(options);
    if (provider === "claude") adapters.claude = createClaudeAdapter(options);
  }
  return adapters;
}

export async function delegate(options: Options, io: IO, config: Config, deps: Deps): Promise<number> {
  const pkg = parseTaskPackage(readFileSync(options.file, "utf8"));
  if (options.providers !== undefined) {
    pkg.providers = options.providers.split(",").map((provider) => {
      if (provider !== "codex" && provider !== "claude" && provider !== "fake") throw new Error(`Unknown provider: ${provider}`);
      return provider;
    });
    if (pkg.providers.includes("fake") && pkg.providers.some(provider => provider !== "fake")) throw new Error("fake cannot be mixed with other providers");
  }
  const built = buildAdapters(pkg, options.scenario, deps);
  const repo = await findRepoRoot(resolve(io.cwd, options.repo ?? "."));
  validatePaths(repo, pkg.files_to_read);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const check = () => controller.signal.throwIfAborted();
    const baseRef = await currentBase(repo);
    const suffix = deps.newId?.() ?? randomBytes(2).toString("hex");
    const taskId = `${pkg.id}-${suffix}`;
    check();
    await excludeWorktrees(repo);
    const worktree = await createWorktree(repo, taskId, baseRef);
    check();
    const cwd = resolve(repo, worktree.path);
    const adapters: Partial<Record<ProviderName, ProviderAdapter>> = {};
    for (const provider of pkg.providers) {
      const adapter = built[provider];
      if (adapter) adapters[provider] = { name: provider, run: (input) => adapter.run({ ...input, cwd: resolve(repo, input.cwd) }), review: (input) => adapter.review({ ...input, cwd: resolve(repo, input.cwd) }) };
    }
    const writer = createEventWriter(options.eventsDir, taskId);
    const events: Event[] = [];
    const result = await runTask(pkg, {
      now: deps.now ?? (() => new Date()), newId: () => suffix, models: config.models, worktree, signal: controller.signal, adapters,
      emit(event) { check(); writer.emit(event); events.push(event); },
      ...(pkg.setup === undefined ? {} : { setup: async (path: string, command: string) => {
        check();
        const outcome = await runVerifyCommand(resolve(repo, path), command, { timeoutMs: config.verifyTimeoutMs, signal: controller.signal });
        check();
        return outcome;
      } }),
      async runVerify(path, command) {
        check();
        await stageAll(resolve(repo, path));
        check();
        const run = () => runVerifyCommand(resolve(repo, path), command, { timeoutMs: config.verifyTimeoutMs, signal: controller.signal });
        const outcome = options.overlay === undefined ? await run() : await verifyWithOverlay(options.overlay, cwd, run, io);
        check();
        await stageAll(cwd);
        return outcome;
      },
      async diffStat() { check(); return diffStat(cwd, baseRef); },
    });
    check();
    await commitAll(cwd, `panosu: ${taskId}`);
    check();
    report(events, writer.path, io);
    return { passed: 0, needs_review: 1, failed: 2 }[result.status];
  } catch (error) {
    if (controller.signal.aborted) return 130;
    throw error;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
