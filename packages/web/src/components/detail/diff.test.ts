import { describe, expect, it } from "vitest";
import { parseDiff } from "./diff.js";

const MULTI = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 111..222 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,3 +1,4 @@ function x",
  " keep",
  "-old",
  "+new",
  "+extra",
  " tail",
  "diff --git a/src/b.ts b/src/b.ts",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/src/b.ts",
  "@@ -0,0 +1,2 @@",
  "+--- looks like a header",
  "+two",
  "\\ No newline at end of file",
  "",
].join("\n");

describe("parseDiff", () => {
  it("parses multiple files, hunks and line numbers", () => {
    const { files, truncation } = parseDiff(MULTI);
    expect(truncation).toBeNull();
    expect(files.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts"]);
    const lines = files[0]?.hunks[0]?.lines ?? [];
    expect(lines.map((l) => [l.kind, l.text, l.oldNo, l.newNo])).toEqual([
      ["ctx", "keep", 1, 1], ["del", "old", 2, null], ["add", "new", null, 2], ["add", "extra", null, 3], ["ctx", "tail", 3, 4],
    ]);
    expect(files[0]?.hunks[0]?.header).toBe("@@ -1,3 +1,4 @@ function x");
    expect(files[1]?.notes).toContain("new file mode 100644");
  });

  it("treats +++-looking lines inside a hunk as additions and keeps the no-newline note", () => {
    const lines = parseDiff(MULTI).files[1]?.hunks[0]?.lines ?? [];
    expect(lines.map((l) => l.kind)).toEqual(["add", "add", "note"]);
    expect(lines[0]?.text).toBe("--- looks like a header");
  });

  it("marks binary files", () => {
    const { files } = parseDiff("diff --git a/i.png b/i.png\nindex 1..2 100644\nBinary files a/i.png and b/i.png differ\n");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: "i.png", binary: true, hunks: [] });
  });

  it("handles an empty diff", () => {
    expect(parseDiff("")).toEqual({ files: [], truncation: null });
  });

  it("captures the truncation marker, even inside an unfinished hunk", () => {
    const text = "diff --git a/a b/a\n@@ -1,5 +1,5 @@\n-a\n+b\n[diff truncated: 1234 bytes omitted]\n";
    const { files, truncation } = parseDiff(text);
    expect(truncation).toBe("[diff truncated: 1234 bytes omitted]");
    expect(files[0]?.hunks[0]?.lines).toHaveLength(2);
  });
});
