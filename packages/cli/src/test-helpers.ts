import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { eventSchema, type TaskPackage } from "@dugout/core";
import { main, type Deps } from "./cli.js";

const exec = promisify(execFile);
export async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await exec("git", args, { cwd })).stdout.trim();
}
export async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "dugout-cli-"));
  const repo = join(dir, "repo");
  mkdirSync(repo);
  await git(repo, "init", "-b", "main");
  writeFileSync(join(repo, "initial"), "initial\n");
  await git(repo, "add", "-A");
  await git(repo, "-c", "user.name=t", "-c", "user.email=t@localhost", "commit", "-m", "Initial");
  return { dir, repo, events: join(dir, "events"), file: join(dir, "task.md") };
}
export function packageFile(file: string, changes: Partial<TaskPackage> = {}) {
  const pkg = { id: "task", goal: "Test", files_to_read: [], constraints: [], acceptance: ["Works"], verify: "true", providers: ["codex", "claude"], review: true, max_retries: 2, ...changes };
  writeFileSync(file, `---\n${JSON.stringify(pkg)}\n---\n`);
}
export function readEvents(file: string) {
  return readFileSync(file, "utf8").trim().split("\n").map((line) => eventSchema.parse(JSON.parse(line)));
}
export async function invoke(ctx: Awaited<ReturnType<typeof setup>>, args: string[], deps: Deps = {}) {
  let stdout = "";
  let stderr = "";
  const code = await main(args, { cwd: ctx.repo, homedir: ctx.dir, stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } }, { newId: () => "abcd", ...deps });
  return { code, stdout, stderr };
}
