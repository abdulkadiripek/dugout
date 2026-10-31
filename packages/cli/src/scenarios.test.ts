import { expect, it } from "vitest";
import { scenarioSpec } from "./scenarios.js";

it("maps outcomes to provider positions and supplies six successes and reviewer adapters", () => {
  expect(scenarioSpec("success", ["claude", "codex"]).claude).toHaveLength(6);
  expect(scenarioSpec("fallback", ["claude", "codex"])).toMatchObject({ claude: [{ exit: "rate_limit" }], codex: Array.from({ length: 6 }, () => ({ exit: "ok" })) });
  expect(scenarioSpec("all-failed", ["codex", "claude"])).toMatchObject({ codex: [{ exit: "rate_limit" }], claude: [{ exit: "auth" }] });
  expect(scenarioSpec("review-issues", ["fake"]).review).toBe("changes_requested");
  expect(() => scenarioSpec("fallback", ["fake"])).toThrow("2 provider positions");
  expect(() => scenarioSpec("unknown", ["fake"])).toThrow("Unknown scenario");
});
