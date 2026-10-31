import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL(".", import.meta.url);
const sources = readdirSync(dir)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "test-helpers.ts")
  .map((name) => ({ name, text: readFileSync(new URL(name, dir), "utf8") }));

describe("read-only guarantee", () => {
  it("finds the source files", () => {
    expect(sources.map((source) => source.name)).toContain("app.ts");
  });

  it("uses no fs write APIs", () => {
    const forbidden = /\b(writeFile|appendFile|mkdir|rm|rmdir|unlink|rename|copyFile|createWriteStream|open|truncate|symlink|link|chmod)(Sync)?\s*\(/;
    for (const { name, text } of sources) expect(text, name).not.toMatch(forbidden);
  });

  it("spawns only git through execFile", () => {
    for (const { name, text } of sources) {
      expect(text, name).not.toMatch(/\b(exec|execSync|spawn|spawnSync|execFileSync|fork)\s*\(/);
      expect(text, name).not.toMatch(/import\s*\{[^}]*\b(?!execFile\b)\w+[^}]*\}\s*from\s*"node:child_process"/);
      for (const call of text.matchAll(/\bexecFile\(\s*([^,]+),/g)) expect(call[1], name).toBe('"git"');
    }
    const users = sources.filter((source) => source.text.includes("node:child_process")).map((source) => source.name);
    expect(users.sort()).toEqual(["bin.ts", "diff.ts"]);
  });
});
