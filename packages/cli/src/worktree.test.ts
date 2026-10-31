import { afterEach, beforeEach, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitAll, createWorktree, currentBase, diffStat, findRepoRoot, removeWorktree, stageAll } from "./worktree.js";

let dir: string;
let repo: string;
const identity = ["-c", "user.name=dugout", "-c", "user.email=dugout@localhost"];
function git(cwd: string, ...args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, encoding: "utf8" }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "dugout-git-"));
  repo = join(dir, "repo");
  mkdirSync(repo);
  await git(repo, "init", "-b", "main");
  writeFileSync(join(repo, ".gitignore"), ".worktrees/\n");
  writeFileSync(join(repo, "original.txt"), "before\n");
  await git(repo, "add", "-A");
  await git(repo, ...identity, "commit", "-m", "Initial commit");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("creates an isolated worktree, stages, measures, commits and removes it while retaining its branch", async () => {
  expect(await findRepoRoot(repo)).toBe(repo);
  expect(await currentBase(repo)).toBe("main");
  const tree = await createWorktree(repo, "task-1234", "main");
  expect(tree).toEqual({ path: ".worktrees/task-1234", branch: "dugout/task-1234", baseRef: "main" });
  const cwd = join(repo, tree.path);
  expect(await currentBase(cwd)).toBe(tree.branch);
  expect(await findRepoRoot(cwd)).toBe(cwd);
  writeFileSync(join(cwd, "original.txt"), "after\nsecond\n");
  writeFileSync(join(cwd, "new.txt"), "new\n");
  expect(await diffStat(cwd, "main")).toEqual({ files: 0, additions: 0, deletions: 0 });
  await stageAll(cwd);
  expect(await diffStat(cwd, "main")).toEqual({ files: 2, additions: 3, deletions: 1 });
  expect(await git(repo, "status", "--porcelain")).toBe("");
  expect(readFileSync(join(repo, "original.txt"), "utf8")).toBe("before\n");
  expect(existsSync(join(repo, "new.txt"))).toBe(false);
  expect(await commitAll(cwd, "Implement task")).toBe(true);
  const head = await git(cwd, "rev-parse", "HEAD");
  expect(await git(cwd, "log", "-1", "--format=%an <%ae>")).toBe("dugout <dugout@localhost>");
  expect(await commitAll(cwd, "No changes")).toBe(false);
  expect(await git(cwd, "rev-parse", "HEAD")).toBe(head);
  writeFileSync(join(cwd, "untracked.txt"), "discard\n");
  await removeWorktree(repo, "task-1234");
  expect(existsSync(cwd)).toBe(false);
  expect(await git(repo, "rev-parse", tree.branch)).toBe(head);
  expect(await git(repo, "status", "--porcelain")).toBe("");
});

it("counts binary files and renamed files", async () => {
  writeFileSync(join(repo, "binary"), Buffer.from([0, 1, 2]));
  await git(repo, "mv", "original.txt", "renamed.txt");
  await stageAll(repo);
  expect(await diffStat(repo, "HEAD")).toEqual({ files: 2, additions: 0, deletions: 0 });
});

it("returns a hash for detached HEAD and reports non-repositories", async () => {
  const head = await git(repo, "rev-parse", "HEAD");
  await git(repo, "checkout", "--detach", head);
  expect(await currentBase(repo)).toBe(head);
  await expect(findRepoRoot(dir)).rejects.toThrow(/git rev-parse failed:.*not a git repository/s);
});

it("commits despite failing hooks and unusable signing", async () => {
  await git(repo, "config", "commit.gpgsign", "true");
  await git(repo, "config", "gpg.program", "/nonexistent/gpg");
  mkdirSync(join(repo, ".git/hooks"), { recursive: true });
  writeFileSync(join(repo, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  writeFileSync(join(repo, "new.txt"), "new\n");
  await stageAll(repo);
  expect(await commitAll(repo, "hardened")).toBe(true);
  expect(await git(repo, "log", "-1", "--format=%s")).toBe("hardened");
});
