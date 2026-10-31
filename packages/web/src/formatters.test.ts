import { describe, expect, it } from "vitest";
import { formatCount, formatDate, formatDateTime, formatDuration, formatTokens } from "./formatters.js";

describe("formatters", () => {
  it("formats durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(450)).toBe("450ms");
    expect(formatDuration(2500)).toBe("2.5s");
    expect(formatDuration(42000)).toBe("42s");
    expect(formatDuration(125000)).toBe("2m 05s");
    expect(formatDuration(119600)).toBe("2m 00s");
    expect(formatDuration(3_900_000)).toBe("1h 05m");
  });

  it("formats token counts", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(12000)).toBe("12k");
    expect(formatCount(15300)).toBe("15.3k");
    expect(formatTokens({ input: 8000, output: 4000 })).toEqual({ input: "8,000", output: "4,000", total: "12k" });
  });

  it("formats dates in UTC", () => {
    expect(formatDate("2026-10-31T20:29:49.000Z")).toBe("2026-10-31");
    expect(formatDate("")).toBe("—");
    expect(formatDateTime("2026-10-31T20:29:49.000Z")).toBe("2026-10-31 20:29 UTC");
  });
});
