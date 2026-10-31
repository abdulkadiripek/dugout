// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Scorecard } from "../api.js";
import { ScorecardScreen } from "./ScorecardScreen.js";

const CARD: Scorecard = {
  implementers: [
    { provider: "codex", model: "gpt-x", tasks: 4, passed: 3, firstTryPassRate: 0.5, meanRetries: 1.25, meanDurationMs: 65000, inputTokens: 8000, outputTokens: 2000 },
    { provider: "claude", model: "sonnet-x", tasks: 1, passed: 1, firstTryPassRate: 1, meanRetries: 0, meanDurationMs: 4000, inputTokens: 1000, outputTokens: 1000 },
  ],
  reviewers: [
    { provider: "claude", model: "sonnet-x", reviews: 2, blocker: 1, major: 2, minor: 0, nit: 3 },
  ],
  excluded: { interrupted: 2, unreadable: 1 },
};

function stub(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ScorecardScreen", () => {
  it("renders implementers in API order with donut percentages", async () => {
    stub(CARD);
    render(<ScorecardScreen />);
    const impl = await screen.findByRole("list", { name: "Implementers" });
    const cards = within(impl).getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText("codex")).toBeTruthy();
    expect(within(cards[0]!).getByRole("img", { name: "First-try pass rate 50%" })).toBeTruthy();
    expect(within(cards[0]!).getByText("1.25")).toBeTruthy();
    expect(within(cards[0]!).getByText("1m 05s")).toBeTruthy();
    expect(within(cards[0]!).getByRole("img", { name: "8,000 input, 2,000 output tokens" })).toBeTruthy();
    expect(within(cards[1]!).getByRole("img", { name: "First-try pass rate 100%" })).toBeTruthy();
  });

  it("normalizes token bars across rows", async () => {
    stub(CARD);
    const { container } = render(<ScorecardScreen />);
    await screen.findByRole("list", { name: "Implementers" });
    const bars = container.querySelectorAll<HTMLElement>(".sc-panel.sc:not(.sev-stack) .bar");
    expect(bars[0]?.querySelectorAll("span")[0]?.style.width).toBe("80%");
    expect(bars[1]?.querySelectorAll("span")[0]?.style.width).toBe("10%");
  });

  it("renders reviewer severity as text and bars", async () => {
    stub(CARD);
    render(<ScorecardScreen />);
    const rev = await screen.findByRole("list", { name: "Reviewers" });
    expect(within(rev).getByRole("img", { name: "6 issues by severity: 1 blocker, 2 major, 0 minor, 3 nit" })).toBeTruthy();
    expect(rev.textContent).toContain("blocker 1");
    expect(rev.textContent).toContain("nit 3");
    expect(within(rev).getByText("reviews")).toBeTruthy();
  });

  it("states the excluded counts", async () => {
    stub(CARD);
    render(<ScorecardScreen />);
    expect(await screen.findByText(/Left out: 2 interrupted and 1 unreadable logs/)).toBeTruthy();
  });

  it("shows the empty state mentioning pnpm demo", async () => {
    stub({ implementers: [], reviewers: [], excluded: { interrupted: 0, unreadable: 0 } });
    render(<ScorecardScreen />);
    expect(await screen.findByText("No finished tasks yet.")).toBeTruthy();
    expect(screen.getByText("pnpm demo")).toBeTruthy();
  });

  it("shows an error and retries", async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "boom" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(CARD), { status: 200 }));
    vi.stubGlobal("fetch", fn);
    render(<ScorecardScreen />);
    expect((await screen.findByRole("alert")).textContent).toContain("boom");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("list", { name: "Implementers" })).toBeTruthy());
  });
});
