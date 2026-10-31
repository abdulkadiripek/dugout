import { expect, it } from "vitest";
import { shellSummary } from "./shared.js";

it.each([
  ["bash -lc 'cat AGENTS.md'", "cat AGENTS.md"],
  ["/usr/bin/bash -lc \"pnpm typecheck\"", "pnpm typecheck"],
  ["sh -c 'ls -la'", "ls -la"],
  ["bash -lc 'git status\nrm -rf x'", "git status"],
  ["git log\nsecret", "git log"],
  ["git log --oneline -n 5 extra", "git log --oneline"],
  ["FOO=secret pnpm test", "FOO=… pnpm test"],
  ["export TOKEN=abc123", "export TOKEN=…"],
  ["cat /tmp/work/src/a.ts", "cat src/a.ts"],
  ["", ""],
  ["  \n ", ""],
])("summarizes %j as %j", (command, expected) => {
  expect(shellSummary(command, "/tmp/work")).toBe(expected);
});
it("truncates a long word to 60 characters", () => {
  expect(shellSummary("x".repeat(200))).toBe("x".repeat(60));
});
