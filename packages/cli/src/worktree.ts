import { execFile } from "node:child_process";

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) reject(new Error(`git ${args[0]} failed: ${stderr.trim() || error.message}`));
      else resolve(stdout.trim());
    });
  });
}

function taskPath(taskId: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(taskId)) throw new Error("Invalid taskId");
  return `.worktrees/${taskId}`;
}

export function findRepoRoot(cwd: string): Promise<string> {
  return git(cwd, ["rev-parse", "--show-toplevel"]);
}

export async function currentBase(repo: string): Promise<string> {
  const branch = await git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return branch === "HEAD" ? git(repo, ["rev-parse", "HEAD"]) : branch;
}

export interface Worktree {
  path: string;
  branch: string;
  baseRef: string;
}

export async function createWorktree(repo: string, taskId: string, baseRef: string): Promise<Worktree> {
  const path = taskPath(taskId);
  const branch = `panosu/${taskId}`;
  await git(repo, ["worktree", "add", "-b", branch, path, baseRef]);
  return { path, branch, baseRef };
}

export async function removeWorktree(repo: string, taskId: string): Promise<void> {
  await git(repo, ["worktree", "remove", "--force", taskPath(taskId)]);
}

export async function stageAll(worktreeDir: string): Promise<void> {
  await git(worktreeDir, ["add", "-A"]);
}

export interface DiffStat {
  files: number;
  additions: number;
  deletions: number;
}

export async function diffStat(worktreeDir: string, baseRef: string): Promise<DiffStat> {
  const output = await git(worktreeDir, ["diff", "--cached", "--numstat", "-z", baseRef, "--"]);
  const fields = output.split("\0");
  const stat = { files: 0, additions: 0, deletions: 0 };
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field) continue;
    const [additions, deletions, path] = field.split("\t");
    stat.files++;
    stat.additions += additions === "-" ? 0 : Number(additions);
    stat.deletions += deletions === "-" ? 0 : Number(deletions);
    if (path === "") i += 2;
  }
  return stat;
}

export async function commitAll(worktreeDir: string, message: string): Promise<boolean> {
  if (!(await git(worktreeDir, ["diff", "--cached", "--name-only"]))) return false;
  await git(worktreeDir, ["-c", "user.name=panosu", "-c", "user.email=panosu@localhost", "commit", "-m", message]);
  return true;
}
