import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = import.meta.dirname;
const srcDir = join(root, "src");
const mutantDir = join(root, "mutants");

function runTests(dir: string) {
  const env = { ...process.env };
  delete env["NODE_TEST_CONTEXT"];
  return spawnSync(process.execPath, ["--test"], { cwd: dir, env, encoding: "utf8", timeout: 20000 });
}

function stage(stats: string): string {
  const dir = mkdtempSync(join(tmpdir(), "panosu-mutant-"));
  writeFileSync(join(dir, "package.json"), '{"type":"module"}\n');
  mkdirSync(join(dir, "src"));
  copyFileSync(stats, join(dir, "src", "stats.ts"));
  for (const name of readdirSync(srcDir)) {
    if (name.endsWith(".test.ts")) copyFileSync(join(srcDir, name), join(dir, "src", name));
  }
  return dir;
}

test("the implementer's tests exist, pass on the real code and kill at least 80% of mutants", () => {
  const testFiles = readdirSync(srcDir).filter((name) => name.endsWith(".test.ts"));
  assert.ok(testFiles.length > 0, "no test file in src/");

  const real = stage(join(srcDir, "stats.ts"));
  try {
    const result = runTests(real);
    assert.equal(result.status, 0, `tests fail on the real code:\n${result.stdout}`);
    assert.match(result.stdout, /ℹ pass [1-9]/, "no tests were run");
  } finally {
    rmSync(real, { recursive: true, force: true });
  }

  const mutants = readdirSync(mutantDir).filter((name) => name.endsWith(".ts"));
  assert.ok(mutants.length >= 5);
  let killed = 0;
  for (const mutant of mutants) {
    const dir = stage(join(mutantDir, mutant));
    try {
      if (runTests(dir).status !== 0) killed++;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  assert.ok(killed / mutants.length >= 0.8, `killed ${killed} of ${mutants.length} mutants`);
});
