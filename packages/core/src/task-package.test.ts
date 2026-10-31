import { describe, expect, it } from "vitest";
import { parseTaskPackage, taskPackageSchema } from "./index.js";

const example = `---
id: add-fake-provider
goal: Implement the \`fake\` provider with success, failure and rate_limit scenarios.
files_to_read:
  - packages/core/src/adapter.ts
constraints:
  - No real model calls.
  - Keep the public adapter interface unchanged.
acceptance:
  - A rate_limit scenario returns exitReason "rate_limit".
  - Unit tests cover all three scenarios.
verify: pnpm test
max_retries: 2
review: true
providers: [fake]
---

Optional notes for the implementer. Anything it needs must be here or in \`files_to_read\`.
`;

const minimal = {
  id: "task-1", goal: "Implement a helper.", files_to_read: [],
  constraints: [], acceptance: ["Tests pass"], verify: "pnpm test",
};

describe("task packages", () => {
  it("parses the contract example", () => {
    expect(parseTaskPackage(example)).toEqual({
      id: "add-fake-provider",
      goal: "Implement the `fake` provider with success, failure and rate_limit scenarios.",
      files_to_read: ["packages/core/src/adapter.ts"],
      constraints: ["No real model calls.", "Keep the public adapter interface unchanged."],
      acceptance: ['A rate_limit scenario returns exitReason "rate_limit".', "Unit tests cover all three scenarios."],
      verify: "pnpm test", max_retries: 2, review: true, providers: ["fake"],
    });
  });

  it("applies defaults", () => {
    expect(taskPackageSchema.parse(minimal)).toEqual({
      ...minimal, max_retries: 2, review: true, providers: ["codex", "claude"],
    });
  });

  it("preserves explicit options", () => {
    expect(taskPackageSchema.parse({
      ...minimal, max_retries: 0, review: false, providers: ["claude", "codex"],
    })).toMatchObject({ max_retries: 0, review: false, providers: ["claude", "codex"] });
  });

  it.each(["/tmp/file", "../file", "src/../file", "src/..", "C:/file", "src\\file", "//server/file"])(
    "rejects unsafe files_to_read path %s", (path) => {
      expect(() => taskPackageSchema.parse({ ...minimal, files_to_read: [path] }))
        .toThrow(/files_to_read/);
    },
  );

  it.each([
    ["acceptance", undefined], ["acceptance", []],
    ["verify", ""], ["verify", " \n "], ["files_to_read", undefined],
    ["constraints", undefined], ["goal", ""], ["id", "Bad_id"],
    ["max_retries", -1], ["max_retries", 6], ["max_retries", 1.5],
    ["providers", ["unknown"]], ["review", "true"],
  ])("rejects invalid %s (%j)", (field, value) => {
    expect(() => taskPackageSchema.parse({ ...minimal, [field]: value })).toThrow(field);
  });

  it("accepts relative paths containing harmless dots", () => {
    expect(taskPackageSchema.parse({ ...minimal, files_to_read: ["./src/file.ts", "src/file..ts"] })
      .files_to_read).toHaveLength(2);
  });

  it("handles CRLF frontmatter and no body", () => {
    expect(parseTaskPackage(example.split("\n").join("\r\n"))).toEqual(parseTaskPackage(example));
    expect(parseTaskPackage(example.slice(0, example.indexOf("\n---", 4) + 4))).toEqual(parseTaskPackage(example));
  });

  it.each(["no frontmatter", "---\nid: task", "text\n" + example])(
    "rejects missing or misplaced delimiters", (markdown) => {
      expect(() => parseTaskPackage(markdown)).toThrow(/frontmatter/);
    },
  );

  it("rejects malformed YAML and invalid frontmatter values", () => {
    expect(() => parseTaskPackage("---\nid: [\n---")).toThrow();
    expect(() => parseTaskPackage("---\nnull\n---")).toThrow();
    expect(() => parseTaskPackage("---\nid: task\n---")).toThrow(/acceptance/);
  });
});

it("round-trips optional setup through frontmatter", () => {
  const setup = "pnpm install --offline --frozen-lockfile";
  expect(taskPackageSchema.parse(minimal)).not.toHaveProperty("setup");
  expect(parseTaskPackage(example.replace("verify: pnpm test", `setup: ${setup}\nverify: pnpm test`)))
    .toEqual({ ...parseTaskPackage(example), setup });
});

it.each(["", " \n "])("rejects empty setup %j", (setup) => {
  expect(() => taskPackageSchema.parse({ ...minimal, setup })).toThrow(/setup must be non-empty/);
});
