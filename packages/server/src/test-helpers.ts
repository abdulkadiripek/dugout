import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await exec("git", args, { cwd })).stdout.trim();
}

export const fixture = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/events/${name}.jsonl`, import.meta.url), "utf8");

export async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "dugout-server-"));
  const repo = join(dir, "repo");
  const events = join(dir, "events");
  mkdirSync(repo);
  mkdirSync(events);
  await git(repo, "init", "-b", "main");
  writeFileSync(join(repo, "initial"), "initial\n");
  await git(repo, "add", "-A");
  await git(repo, "-c", "user.name=t", "-c", "user.email=t@localhost", "commit", "-m", "Initial");
  return { dir, repo, events };
}

export async function commitOnBranch(repo: string, branch: string, file: string, content: string) {
  await git(repo, "checkout", "-b", branch);
  writeFileSync(join(repo, file), content);
  await git(repo, "add", "-A");
  await git(repo, "-c", "user.name=t", "-c", "user.email=t@localhost", "commit", "-m", "Change");
  await git(repo, "checkout", "main");
}

export function writeLog(events: string, id: string, text: string) {
  writeFileSync(join(events, `${id}.jsonl`), text);
}
