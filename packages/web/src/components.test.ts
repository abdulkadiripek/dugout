// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement as h } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AttemptDots, attemptOutcomes } from "./components/AttemptDots.js";
import { ProviderBadges } from "./components/ProviderBadges.js";
import { StatusPill } from "./components/StatusPill.js";

afterEach(cleanup);

describe("components", () => {
  it("StatusPill shows icon and label", () => {
    render(h(StatusPill, { status: "needs_review" }));
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("!")).toBeTruthy();
  });

  it("ProviderBadges joins providers in order or says none", () => {
    const { container, rerender } = render(h(ProviderBadges, { providers: ["codex", "claude"] }));
    expect(container.textContent).toContain("codex");
    expect(container.textContent?.indexOf("codex")).toBeLessThan(container.textContent?.indexOf("claude") ?? -1);
    rerender(h(ProviderBadges, { providers: [] }));
    expect(container.textContent).toBe("none");
  });

  it("attemptOutcomes marks earlier attempts failed and the last by status", () => {
    expect(attemptOutcomes(3, "passed")).toEqual(["failed", "failed", "passed"]);
    expect(attemptOutcomes(2, "failed")).toEqual(["failed", "failed"]);
    expect(attemptOutcomes(1, "interrupted")).toEqual(["interrupted"]);
    expect(attemptOutcomes(0, "passed")).toEqual([]);
  });

  it("AttemptDots has an accessible label", () => {
    render(h(AttemptDots, { attempts: 2, status: "passed" }));
    expect(screen.getByRole("img", { name: "attempt 1 failed, attempt 2 ok" })).toBeTruthy();
    cleanup();
    render(h(AttemptDots, { attempts: 0, status: "failed" }));
    expect(screen.getByText("no attempts")).toBeTruthy();
  });
});
