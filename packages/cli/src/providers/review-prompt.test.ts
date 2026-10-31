import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildReviewPrompt, defaultGetDiff, reviewJsonSchema, truncateDiff } from "./review-prompt.js";

it("matches the recorded strict JSON schema", async () => {
  const schema = await readFile(new URL("../../../../fixtures/providers/codex/review-output.schema.json", import.meta.url), "utf8");
  expect(reviewJsonSchema).toEqual(JSON.parse(schema));
});
it("includes goal, all acceptance criteria and diff", () => {
  const prompt = buildReviewPrompt({ goal: "goal text", acceptance: ["first item", "second item"], diff: "+new line" });
  for (const text of ["goal text", "first item", "second item", "+new line"]) expect(prompt).toContain(text);
});
it("preserves an in-budget diff including exact byte boundary", () => {
  expect(truncateDiff("é\n", 3)).toBe("é\n");
  expect(truncateDiff("small")).toBe("small");
  expect(truncateDiff("")).toBe("");
});
it("cuts on line boundaries and counts omitted UTF-8 bytes", () => {
  expect(truncateDiff("é\n😀\nlast", 7)).toBe("é\n[diff truncated: 9 bytes omitted]");
  expect(truncateDiff("é\n😀\nlast", 8)).toBe("é\n😀\n[diff truncated: 4 bytes omitted]");
  expect(truncateDiff("abcdef", 2)).toBe("[diff truncated: 6 bytes omitted]");
  expect(truncateDiff("a\nb", 0)).toBe("[diff truncated: 3 bytes omitted]");
});
it("uses the default 60000-byte content budget", () => {
  const diff = "a\n".repeat(30001);
  expect(truncateDiff(diff)).toBe(`${"a\n".repeat(30000)}[diff truncated: 2 bytes omitted]`);
  expect(buildReviewPrompt({ goal: "", acceptance: [], diff })).toContain("[diff truncated: 2 bytes omitted]");
});
it("reads only the staged diff against the supplied base", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "panosu-diff-"));
  const git = (...args: string[]) => promisify(execFile)("git", args, { cwd });
  try {
    await git("init");
    await writeFile(join(cwd, "file.txt"), "base\n");
    await git("add", ".");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "base");
    await writeFile(join(cwd, "file.txt"), "staged\n");
    await git("add", ".");
    await writeFile(join(cwd, "file.txt"), "unstaged\n");
    const diff = await defaultGetDiff(cwd, "HEAD");
    expect(diff).toContain("-base\n+staged");
    expect(diff).not.toContain("unstaged");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
