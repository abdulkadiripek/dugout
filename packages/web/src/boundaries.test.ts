import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL(".", import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("package boundaries", () => {
  it("imports core only as types and never imports server or cli", () => {
    for (const file of sources(root)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (/from\s+["']@panosu\/(server|cli)["']/.test(line)) throw new Error(`${file}: ${line.trim()}`);
        if (/from\s+["']@panosu\/core["']/.test(line)) expect(line, file).toMatch(/^\s*(import|export)\s+type\b/);
      }
    }
  });
});
