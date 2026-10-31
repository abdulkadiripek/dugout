import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { scan } from "./scan-repo.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "scan-repo.mjs");
const dirs = [];

function makeRepo(files, { track = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "scan-repo-test-"));
  dirs.push(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  if (track) execFileSync("git", ["add", "-A", "-f"], { cwd: dir });
  return dir;
}

const rulesFor = (files) => scan(makeRepo(files)).map((f) => f.rule);

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("content rules", () => {
  it("flags absolute home paths but not generic ones", () => {
    expect(rulesFor({ "a.txt": "see /ho" + "me/bob/work\n" })).toEqual(["home-path"]);
    expect(rulesFor({ "a.txt": "see /Us" + "ers/bob/work\n" })).toEqual(["home-path"]);
    expect(rulesFor({ "a.txt": "see C:\\Us" + "ers\\bob\\work\n" })).toEqual(["home-path"]);
    expect(rulesFor({ "a.txt": "~/work /ho" + "me/runner/x /ho" + "me/user/x\n" })).toEqual([]);
  });

  it("flags personal emails but not allowed domains", () => {
    expect(rulesFor({ "a.txt": "bob" + "@gmail.com\n" })).toEqual(["email"]);
    expect(rulesFor({ "a.txt": "a@example.com b@localhost c@users.noreply.github.com @types/node\n" })).toEqual([]);
  });

  it("flags secret-looking tokens", () => {
    const planted = {
      "openai-key": "sk" + "-" + "a".repeat(24),
      "github-token": "gh" + "p_" + "A".repeat(30),
      "aws-access-key": "AK" + "IA" + "B".repeat(16),
      "private-key": "-----BEGIN " + "RSA PRIVATE KEY-----",
      "slack-token": "xo" + "xb-" + "1234567890-abc",
    };
    for (const [rule, text] of Object.entries(planted)) {
      expect(rulesFor({ "a.txt": `x ${text}\n` })).toEqual([rule]);
    }
    expect(rulesFor({ "a.txt": "gh" + "o_" + "A".repeat(30) }))
      .toEqual(["github-token"]);
    expect(rulesFor({ "a.txt": "github" + "_pat_" + "A1_".repeat(10) })).toEqual(["github-token"]);
  });

  it("ignores near-misses", () => {
    const clean = [
      "sk-short",
      "task-" + "a".repeat(30),
      "AK" + "IA" + "B".repeat(15),
      "-----BEGIN CERTIFICATE-----",
      "xo" + "xz-1234567890",
      "gh" + "p_short",
    ].join("\n");
    expect(rulesFor({ "a.txt": clean })).toEqual([]);
  });

  it("reports file and line number", () => {
    const [finding] = scan(makeRepo({ "dir/a.txt": "ok\nok\nbob" + "@gmail.com\n" }));
    expect(finding).toMatchObject({ file: "dir/a.txt", line: 3, rule: "email" });
  });

  it("never previews more than 4 characters of a match", () => {
    const secret = "sk" + "-" + "Z".repeat(30);
    const findings = scan(makeRepo({ "a.txt": `${secret}\nbob` + "@gmail.com\n/ho" + "me/bob/x\n" }));
    expect(findings.length).toBe(3);
    for (const f of findings) {
      expect(f.preview.endsWith("…")).toBe(true);
      expect(f.preview.length).toBe(5);
    }
    expect(findings.map((f) => f.preview).join("")).not.toContain("ZZZZ");
  });
});

describe("tracked local-only files", () => {
  it("flags them", () => {
    const expected = {
      ".env": "tracked-env-file",
      ".env.local": "tracked-env-file",
      "sub/.env": "tracked-env-file",
      "CLAUDE.local.md": "tracked-local-file",
      ".proje/Durum.md": "tracked-local-file",
      ".claude/settings.local.json": "tracked-local-file",
    };
    for (const [name, rule] of Object.entries(expected)) {
      expect(rulesFor({ [name]: "nothing\n" }), name).toEqual([rule]);
    }
  });

  it("allows .env.example and ordinary files", () => {
    expect(rulesFor({ ".env.example": "KEY=\n", ".claude/settings.json": "{}\n", "env.md": "x\n" })).toEqual([]);
  });
});

describe("file selection", () => {
  it("ignores untracked files", () => {
    const dir = makeRepo({ "a.txt": "clean\n" });
    writeFileSync(join(dir, "b.txt"), "bob" + "@gmail.com\n");
    writeFileSync(join(dir, ".env"), "x\n");
    expect(scan(dir)).toEqual([]);
  });

  it("skips binary and oversized files", () => {
    const bad = "bob" + "@gmail.com\n";
    const dir = makeRepo({
      "bin.dat": Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(bad)]),
      "big.txt": bad + "a".repeat(1024 * 1024 + 1),
    });
    expect(scan(dir)).toEqual([]);
  });

  it("skips files tracked but missing on disk", () => {
    const dir = makeRepo({ "gone.txt": "bob" + "@gmail.com\n" });
    rmSync(join(dir, "gone.txt"));
    expect(scan(dir)).toEqual([]);
  });
});

describe("cli", () => {
  it("exits 0 on a clean repo", () => {
    const result = spawnSync("node", [script, makeRepo({ "a.txt": "clean\n" })], { encoding: "utf8" });
    expect(result.status).toBe(0);
  });

  it("exits 1 on a dirty repo and prints a safe line", () => {
    const secret = "sk" + "-" + "Q".repeat(30);
    const result = spawnSync("node", [script, makeRepo({ "a.txt": `\n${secret}\n` })], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("a.txt:2 openai-key sk-Q…");
    expect(result.stdout).not.toContain("QQQQ");
  });

  it("defaults to the git root of the current directory", () => {
    const dir = makeRepo({ "sub/a.txt": "bob" + "@gmail.com\n" });
    const result = spawnSync("node", [script], { cwd: join(dir, "sub"), encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("sub/a.txt:1 email");
  });
});
