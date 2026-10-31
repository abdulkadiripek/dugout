import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError, loadConfig } from "./config.js";

let dir: string;
let file: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "panosu-config-")); file = join(dir, "config.json"); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("loadConfig", () => {
  it("uses defaults for missing files and empty config", () => {
    const defaults = {
      models: {
        implement: { codex: "gpt-6-astra", claude: "claude-sonnet-5-5", fake: "fake" },
        review: { codex: "gpt-6.1-sol", claude: "claude-sonnet-5-5", fake: "fake" },
      },
      verifyTimeoutMs: 600000,
    };
    expect(loadConfig(file)).toEqual(defaults);
    writeFileSync(file, "{}");
    expect(loadConfig(file)).toEqual(defaults);
  });
  it("merges overrides per provider and role without mutating defaults", () => {
    writeFileSync(file, JSON.stringify({ models: { codex: { review: "custom" }, fake: { implement: "test" } }, verifyTimeoutMs: 42 }));
    const config = loadConfig(file);
    expect(config.models.review.codex).toBe("custom");
    expect(config.models.implement.codex).toBe("gpt-6-astra");
    expect(config.models.implement.fake).toBe("test");
    expect(config.models.review.fake).toBe("fake");
    expect(config.verifyTimeoutMs).toBe(42);
    expect(loadConfig(join(dir, "missing")).verifyTimeoutMs).toBe(600000);
  });
  it.each([
    ["{", "config"], ["null", "config"], ['{"models":[]}', "models"],
    ['{"models":{"codex":null}}', "models.codex"],
    ['{"models":{"claude":{"implement":12}}}', "models.claude.implement"],
    ['{"models":{"fake":{"review":false}}}', "models.fake.review"],
    ['{"verifyTimeoutMs":"10"}', "verifyTimeoutMs"],
    ['{"verifyTimeoutMs":-1}', "verifyTimeoutMs"],
  ])("rejects invalid config %s and names its key", (text, key) => {
    writeFileSync(file, text);
    expect(() => loadConfig(file)).toThrow(ConfigError);
    expect(() => loadConfig(file)).toThrow(key);
  });
});
